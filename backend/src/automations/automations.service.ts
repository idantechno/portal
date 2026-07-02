import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TasksService } from '../tasks/tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrchestratorService } from '../agents/orchestrator/orchestrator.service';
import { AutomationRule } from './automation-rule.entity';
import { AutomationAction, AutomationTrigger } from './automation.constants';
import { UpsertAutomationDto } from './dto/upsert-automation.dto';

type EventPayload = Record<string, unknown>;

/**
 * The automation engine. CRUD for rules + `emit()` which the rest of the app
 * calls when something happens. Kept deliberately dependency-light: it composes
 * the Tasks and Notifications services to perform actions. `run_agent` is a
 * stub until the Orchestrator is wired in.
 */
@Injectable()
export class AutomationsService {
  private readonly log = new Logger(AutomationsService.name);

  constructor(
    @InjectRepository(AutomationRule)
    private readonly rules: Repository<AutomationRule>,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    private readonly orchestrator: OrchestratorService,
  ) {}

  list(businessId: string): Promise<AutomationRule[]> {
    return this.rules.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    businessId: string,
    dto: UpsertAutomationDto,
    userId: string | null,
  ): Promise<AutomationRule> {
    return this.rules.save(
      this.rules.create({
        businessId,
        name: dto.name,
        enabled: dto.enabled ?? true,
        trigger: dto.trigger,
        conditions: dto.conditions ?? [],
        actions: dto.actions,
        createdByUserId: userId,
      }),
    );
  }

  async update(
    businessId: string,
    id: string,
    dto: UpsertAutomationDto,
  ): Promise<AutomationRule> {
    const rule = await this.rules.findOne({ where: { id, businessId } });
    if (!rule) throw new NotFoundException('Automation not found');
    rule.name = dto.name;
    rule.enabled = dto.enabled ?? rule.enabled;
    rule.trigger = dto.trigger;
    rule.conditions = dto.conditions ?? [];
    rule.actions = dto.actions;
    return this.rules.save(rule);
  }

  async setEnabled(
    businessId: string,
    id: string,
    enabled: boolean,
  ): Promise<AutomationRule> {
    const rule = await this.rules.findOne({ where: { id, businessId } });
    if (!rule) throw new NotFoundException('Automation not found');
    rule.enabled = enabled;
    return this.rules.save(rule);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const res = await this.rules.delete({ id, businessId });
    if (!res.affected) throw new NotFoundException('Automation not found');
  }

  /**
   * Fire an event. Finds enabled rules for this business+trigger, evaluates
   * their conditions against the payload, and runs matching actions. Never
   * throws to the caller — a broken rule must not break the originating action.
   */
  async emit(
    businessId: string,
    trigger: AutomationTrigger,
    payload: EventPayload = {},
  ): Promise<void> {
    let rules: AutomationRule[];
    try {
      rules = await this.rules.find({
        where: { businessId, trigger, enabled: true },
      });
    } catch (err) {
      this.log.error(
        `[automations] failed to load rules for ${trigger}: ${(err as Error).message}`,
      );
      return;
    }

    for (const rule of rules) {
      if (!this.matches(rule, payload)) continue;
      for (const action of rule.actions) {
        try {
          await this.runAction(businessId, action, payload);
        } catch (err) {
          this.log.error(
            `[automations] rule "${rule.name}" action "${action.type}" failed: ${(err as Error).message}`,
          );
        }
      }
      rule.lastRunAt = new Date();
      rule.runCount += 1;
      await this.rules.save(rule).catch(() => undefined);
    }
  }

  /** Dry-run a rule with a sample payload so the owner can test it from the UI. */
  async test(businessId: string, id: string): Promise<{ ran: number }> {
    const rule = await this.rules.findOne({ where: { id, businessId } });
    if (!rule) throw new NotFoundException('Automation not found');
    let ran = 0;
    for (const action of rule.actions) {
      try {
        await this.runAction(businessId, action, { test: true });
        ran += 1;
      } catch (err) {
        this.log.error(
          `[automations] test of "${rule.name}" failed: ${(err as Error).message}`,
        );
      }
    }
    return { ran };
  }

  private matches(rule: AutomationRule, payload: EventPayload): boolean {
    const conditions = rule.conditions ?? [];
    if (conditions.length === 0) return true;
    return conditions.every((c) => payload[c.field] === c.equals);
  }

  private async runAction(
    businessId: string,
    action: AutomationAction,
    payload: EventPayload,
  ): Promise<void> {
    const p = action.params ?? {};
    switch (action.type) {
      case 'create_task': {
        await this.tasks.create({
          businessId,
          title: this.str(p.title) ?? 'משימה מאוטומציה',
          description: this.str(p.description) ?? null,
          priority:
            (this.str(p.priority) as 'low' | 'medium' | 'high') ?? 'medium',
          source: 'automation',
          relatedType: this.str(payload.relatedType) ?? null,
          relatedId: this.str(payload.relatedId) ?? null,
        });
        return;
      }
      case 'notify': {
        await this.notifications.notify({
          businessId,
          type: 'automation',
          title: this.str(p.title) ?? 'אוטומציה הופעלה',
          body: this.str(p.body) ?? null,
          link: this.str(p.link) ?? null,
          channels: Array.isArray(p.channels)
            ? (p.channels as ('email' | 'whatsapp' | 'push')[])
            : undefined,
        });
        return;
      }
      case 'run_agent': {
        const agentKey = this.str(p.agentKey);
        if (!agentKey) {
          this.log.warn('[automations] run_agent action missing agentKey');
          return;
        }
        const instruction =
          this.str(p.instruction) ?? this.instructionFromPayload(payload);
        const result = await this.orchestrator.runAgent(
          businessId,
          agentKey,
          instruction,
        );
        // Deliver the agent's artifact to the owner via the bell so the
        // automation produces something they can see and act on.
        await this.notifications.notify({
          businessId,
          type: 'automation',
          title: `תוצר מ${result.agentName} מוכן`,
          body: result.text.slice(0, 400),
        });
        return;
      }
    }
  }

  /** Default instruction when an automation doesn't specify one. */
  private instructionFromPayload(payload: EventPayload): string {
    const interest = this.str(payload.interest);
    const name = this.str(payload.name);
    if (interest) {
      return `התקבל ליד חדש${name ? ` מ-${name}` : ''}. תחום עניין: ${interest}. הפק תוצר מתאים (הודעת מעקב / תובנה) שיעזור לקדם אותו.`;
    }
    return 'בצע את המשימה לפי ההקשר העסקי והפק תוצר מועיל.';
  }

  private str(v: unknown): string | undefined {
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  }
}

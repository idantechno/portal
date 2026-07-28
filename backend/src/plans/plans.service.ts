import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilesystemService } from '../context-files/filesystem.service';
import { Plan, PlanStatus } from './plan.entity';

export interface CreatePlanInput {
  businessId: string;
  strategyId: string | null;
  customerId?: string | null;
  title: string;
  markdown: string;
  model?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface UpdatePlanInput {
  markdown?: string;
  status?: PlanStatus;
  title?: string;
}

/**
 * CRUD for plans, scoped by businessId. Every write is mirrored (best effort) to
 * `plans/<id>.md` under the business root, so the other agents — whose cwd is
 * that root — can read the plan as business context. The DB row stays the source
 * of truth for the UI.
 */
@Injectable()
export class PlansService {
  private readonly log = new Logger(PlansService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly plans: Repository<Plan>,
    private readonly filesystem: FilesystemService,
  ) {}

  list(businessId: string, customerId?: string): Promise<Plan[]> {
    return this.plans.find({
      where: { businessId, ...(customerId ? { customerId } : {}) },
      order: { updatedAt: 'DESC' },
      select: {
        id: true,
        businessId: true,
        strategyId: true,
        customerId: true,
        title: true,
        status: true,
        model: true,
        edited: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByIdScoped(businessId: string, id: string): Promise<Plan> {
    const plan = await this.plans.findOne({ where: { id, businessId } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  async create(input: CreatePlanInput): Promise<Plan> {
    const plan = this.plans.create({
      businessId: input.businessId,
      strategyId: input.strategyId,
      customerId: input.customerId ?? null,
      title: input.title.trim().slice(0, 255),
      markdown: input.markdown,
      status: 'draft',
      model: input.model ?? null,
      payload: input.payload ?? null,
      edited: false,
    });
    const saved = await this.plans.save(plan);
    await this.mirror(saved);
    return saved;
  }

  async update(
    businessId: string,
    id: string,
    patch: UpdatePlanInput,
  ): Promise<Plan> {
    const plan = await this.findByIdScoped(businessId, id);
    if (patch.markdown !== undefined && patch.markdown !== plan.markdown) {
      plan.markdown = patch.markdown;
      plan.edited = true;
    }
    if (patch.status !== undefined) plan.status = patch.status;
    if (patch.title !== undefined)
      plan.title = patch.title.trim().slice(0, 255);
    const saved = await this.plans.save(plan);
    await this.mirror(saved);
    return saved;
  }

  async remove(businessId: string, id: string): Promise<void> {
    const plan = await this.findByIdScoped(businessId, id);
    await this.plans.remove(plan);
    await this.filesystem
      .deleteFile(businessId, this.artifactPath(id))
      .catch((err) =>
        this.log.warn(
          `Failed to delete plan artifact: ${(err as Error).message}`,
        ),
      );
  }

  private artifactPath(id: string): string {
    return `plans/${id}.md`;
  }

  /** Writes the markdown mirror; never throws — the DB row is authoritative. */
  private async mirror(plan: Plan): Promise<void> {
    try {
      await this.filesystem.ensureBusinessRoot(plan.businessId);
      await this.filesystem.writeFile(
        plan.businessId,
        this.artifactPath(plan.id),
        Buffer.from(plan.markdown, 'utf8'),
      );
    } catch (err) {
      this.log.warn(
        `Failed to mirror plan artifact: ${(err as Error).message}`,
      );
    }
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarService } from '../integrations/calendar.service';
import {
  DEFAULT_TASK_DURATION_MINUTES,
  Task,
  TaskKind,
  TaskSource,
  TaskStatus,
} from './task.entity';

/**
 * Normalize an owner-typed phone into the digits-only WhatsApp form. Handles the
 * common Israeli inputs — "050-123 4567", "+972 50…", "97250…" — and leaves an
 * already-normalized number untouched. Returns null for empty/garbage so a blank
 * field clears the customer recipient rather than storing "".
 */
function toWaPhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

export interface CreateTaskInput {
  businessId: string;
  title: string;
  description?: string | null;
  priority?: Task['priority'];
  dueAt?: string | Date | null;
  /** How long a dated task takes, in minutes. Null → default block length. */
  durationMinutes?: number | null;
  source?: TaskSource;
  /** To-do vs pure nudge. Defaults to 'task'. */
  kind?: TaskKind;
  createdByUserId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  /** Opt this task into the reminders sweep. Defaults to false. */
  remindEnabled?: boolean;
  /** When to fire the reminder (distinct from dueAt). Null → use dueAt. */
  remindAt?: string | Date | null;
  /** Extra WhatsApp recipient — the customer's number. */
  remindCustomerPhone?: string | null;
  /** Customer's display name, to personalize their reminder. */
  remindCustomerName?: string | null;
}

@Injectable()
export class TasksService {
  private readonly log = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    private readonly calendar: CalendarService,
  ) {}

  /**
   * Mirror a dated to-do onto the owner's Google Calendar (write side of the
   * schedule orchestrator). A task belongs on the calendar when it's a `task`
   * (not a reminder), has a due time, and isn't done — otherwise any existing
   * mirror is removed. Best-effort: a calendar hiccup never breaks the task op.
   */
  private async syncCalendar(task: Task): Promise<void> {
    try {
      const shouldMirror =
        task.kind === 'task' && !!task.dueAt && task.status !== 'done';
      if (shouldMirror) {
        if (!(await this.calendar.isConnected(task.businessId))) return;
        const start = task.dueAt!.toISOString();
        const durationMin =
          task.durationMinutes ?? DEFAULT_TASK_DURATION_MINUTES;
        const end = new Date(
          task.dueAt!.getTime() + durationMin * 60_000,
        ).toISOString();
        if (task.calendarEventId) {
          await this.calendar.updateEvent(
            task.businessId,
            task.calendarEventId,
            {
              title: task.title,
              start,
              end,
            },
          );
        } else {
          const ev = await this.calendar.createEvent(task.businessId, {
            title: task.title,
            start,
            end,
          });
          task.calendarEventId = ev.id;
          await this.tasks.update({ id: task.id }, { calendarEventId: ev.id });
        }
      } else if (task.calendarEventId) {
        const eventId = task.calendarEventId;
        task.calendarEventId = null;
        await this.tasks.update({ id: task.id }, { calendarEventId: null });
        if (await this.calendar.isConnected(task.businessId)) {
          await this.calendar.deleteEvent(task.businessId, eventId);
        }
      }
    } catch (err) {
      this.log.warn(
        `[tasks] calendar sync failed for ${task.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Tasks/reminders for a business, filtered. `kind` narrows to to-dos
   * (משימות) or nudges; `remindersOnly` returns everything reminder-enabled
   * (the תזכורות tab — task-reminders AND standalone reminders).
   */
  list(
    businessId: string,
    opts: {
      status?: TaskStatus;
      kind?: TaskKind;
      remindersOnly?: boolean;
    } = {},
  ): Promise<Task[]> {
    return this.tasks.find({
      where: {
        businessId,
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.kind ? { kind: opts.kind } : {}),
        ...(opts.remindersOnly ? { remindEnabled: true } : {}),
      },
      // Open work first, then by soonest due date, then newest.
      order: { status: 'ASC', dueAt: 'ASC', createdAt: 'DESC' },
    });
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const task = this.tasks.create({
      businessId: input.businessId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 'medium',
      source: input.source ?? 'manual',
      kind: input.kind ?? 'task',
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      durationMinutes: input.durationMinutes ?? null,
      createdByUserId: input.createdByUserId ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      remindEnabled: input.remindEnabled ?? false,
      remindAt: input.remindAt ? new Date(input.remindAt) : null,
      remindCustomerPhone: toWaPhone(input.remindCustomerPhone),
      remindCustomerName: input.remindCustomerName?.trim() || null,
      status: 'open',
    });
    const saved = await this.tasks.save(task);
    await this.syncCalendar(saved);
    return saved;
  }

  async update(
    businessId: string,
    id: string,
    patch: Partial<
      Pick<Task, 'title' | 'description' | 'status' | 'priority'>
    > & {
      dueAt?: string | Date | null;
      durationMinutes?: number | null;
      remindEnabled?: boolean;
      remindAt?: string | Date | null;
      remindCustomerPhone?: string | null;
      remindCustomerName?: string | null;
    },
  ): Promise<Task> {
    const task = await this.tasks.findOne({ where: { id, businessId } });
    if (!task) throw new NotFoundException('Task not found');
    if (patch.title !== undefined) task.title = patch.title;
    if (patch.description !== undefined)
      task.description = patch.description ?? null;
    if (patch.priority !== undefined) task.priority = patch.priority;
    if (patch.dueAt !== undefined) {
      task.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
      // Rescheduling revives the reminder — let it fire again at the new time.
      task.notifiedAt = null;
    }
    if (patch.durationMinutes !== undefined) {
      task.durationMinutes = patch.durationMinutes ?? null;
    }
    if (patch.remindEnabled !== undefined) {
      task.remindEnabled = patch.remindEnabled;
      // Turning reminders back on revives delivery for this task.
      if (patch.remindEnabled) task.notifiedAt = null;
    }
    if (patch.remindAt !== undefined) {
      task.remindAt = patch.remindAt ? new Date(patch.remindAt) : null;
      // A new reminder time re-arms delivery.
      task.notifiedAt = null;
    }
    if (patch.remindCustomerPhone !== undefined) {
      task.remindCustomerPhone = toWaPhone(patch.remindCustomerPhone);
    }
    if (patch.remindCustomerName !== undefined) {
      task.remindCustomerName = patch.remindCustomerName?.trim() || null;
    }
    if (patch.status !== undefined) {
      task.status = patch.status;
      task.completedAt = patch.status === 'done' ? new Date() : null;
    }
    const saved = await this.tasks.save(task);
    await this.syncCalendar(saved);
    return saved;
  }

  async remove(businessId: string, id: string): Promise<void> {
    const task = await this.tasks.findOne({ where: { id, businessId } });
    if (!task) throw new NotFoundException('Task not found');
    // Pull its Google mirror before dropping the row. Best-effort.
    if (task.calendarEventId && (await this.calendar.isConnected(businessId))) {
      try {
        await this.calendar.deleteEvent(businessId, task.calendarEventId);
      } catch (err) {
        this.log.warn(
          `[tasks] calendar mirror delete failed for ${id}: ${(err as Error).message}`,
        );
      }
    }
    await this.tasks.delete({ id, businessId });
  }

  /**
   * Deletes every task linked to a related entity (e.g. an appointment's
   * reminders). Used when the source object is cancelled so a stale reminder
   * never fires. Idempotent — returns the number removed, never throws on 0.
   */
  async removeByRelated(
    businessId: string,
    relatedType: string,
    relatedId: string,
  ): Promise<number> {
    const res = await this.tasks.delete({ businessId, relatedType, relatedId });
    return res.affected ?? 0;
  }

  /**
   * True if any task (in any status) is already linked to this related entity.
   * Used by automations to avoid raising the same reminder twice for a doc.
   */
  async existsForRelated(
    businessId: string,
    relatedType: string,
    relatedId: string,
  ): Promise<boolean> {
    const n = await this.tasks.count({
      where: { businessId, relatedType, relatedId },
    });
    return n > 0;
  }

  /** Count of not-yet-done tasks — feeds the cockpit briefing. */
  openCount(businessId: string): Promise<number> {
    return this.tasks
      .createQueryBuilder('t')
      .where('t.business_id = :businessId', { businessId })
      .andWhere('t.status != :done', { done: 'done' })
      .getCount();
  }

  /**
   * Reminder-enabled tasks whose fire time has arrived and haven't been reminded
   * yet (and aren't done). Fire time is `remindAt` when set, otherwise `dueAt` —
   * so a reminder can precede the event. Drives the reminders scheduler —
   * cross-tenant, so no businessId scope.
   */
  findDueReminders(now: Date = new Date()): Promise<Task[]> {
    return this.tasks
      .createQueryBuilder('t')
      .where('t.remind_enabled = true')
      .andWhere('t.notified_at IS NULL')
      .andWhere("t.status != 'done'")
      .andWhere('COALESCE(t.remind_at, t.due_at) IS NOT NULL')
      .andWhere('COALESCE(t.remind_at, t.due_at) <= :now', { now })
      .orderBy('COALESCE(t.remind_at, t.due_at)', 'ASC')
      .take(200)
      .getMany();
  }

  /** Stamp a task as reminded so it never double-fires. */
  async markNotified(id: string): Promise<void> {
    await this.tasks.update({ id }, { notifiedAt: new Date() });
  }

  /**
   * Open TO-DO tasks (kind=task) with a due time inside [from, to). These are
   * real commitments on the owner's timeline, so the schedule brain counts them
   * as busy. Reminders (kind=reminder) are nudges, not busy time — excluded.
   */
  datedInWindow(businessId: string, from: Date, to: Date): Promise<Task[]> {
    return this.tasks
      .createQueryBuilder('t')
      .where('t.business_id = :businessId', { businessId })
      .andWhere("t.kind = 'task'")
      .andWhere("t.status != 'done'")
      .andWhere('t.due_at IS NOT NULL')
      .andWhere('t.due_at >= :from AND t.due_at < :to', { from, to })
      .orderBy('t.due_at', 'ASC')
      .getMany();
  }

  /**
   * Open reminders (kind=reminder) whose fire time (remind_at, else due_at)
   * falls inside [from, to). Nudges — surfaced on the daily agenda but not
   * counted as busy time.
   */
  remindersInWindow(businessId: string, from: Date, to: Date): Promise<Task[]> {
    return this.tasks
      .createQueryBuilder('t')
      .where('t.business_id = :businessId', { businessId })
      .andWhere("t.kind = 'reminder'")
      .andWhere("t.status != 'done'")
      .andWhere('COALESCE(t.remind_at, t.due_at) IS NOT NULL')
      .andWhere('COALESCE(t.remind_at, t.due_at) >= :from', { from })
      .andWhere('COALESCE(t.remind_at, t.due_at) < :to', { to })
      .orderBy('COALESCE(t.remind_at, t.due_at)', 'ASC')
      .getMany();
  }

  /**
   * Hard-delete completed items whose `completedAt` is older than the cutoff
   * (default 48h) — a done task/reminder lingers briefly in the "בוצעו" list,
   * then disappears for good. Cross-tenant, cheap indexed delete; returns the
   * number removed.
   */
  async purgeCompleted(olderThanHours = 48): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 3_600_000);
    const res = await this.tasks
      .createQueryBuilder()
      .delete()
      .where('status = :done', { done: 'done' })
      .andWhere('completed_at IS NOT NULL')
      .andWhere('completed_at < :cutoff', { cutoff })
      .execute();
    return res.affected ?? 0;
  }
}

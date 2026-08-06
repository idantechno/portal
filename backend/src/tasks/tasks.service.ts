import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskKind, TaskSource, TaskStatus } from './task.entity';

export interface CreateTaskInput {
  businessId: string;
  title: string;
  description?: string | null;
  priority?: Task['priority'];
  dueAt?: string | Date | null;
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
  constructor(
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
  ) {}

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
      createdByUserId: input.createdByUserId ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      remindEnabled: input.remindEnabled ?? false,
      remindAt: input.remindAt ? new Date(input.remindAt) : null,
      remindCustomerPhone: input.remindCustomerPhone ?? null,
      remindCustomerName: input.remindCustomerName ?? null,
      status: 'open',
    });
    return this.tasks.save(task);
  }

  async update(
    businessId: string,
    id: string,
    patch: Partial<
      Pick<Task, 'title' | 'description' | 'status' | 'priority'>
    > & {
      dueAt?: string | Date | null;
      remindEnabled?: boolean;
      remindAt?: string | Date | null;
      remindCustomerPhone?: string | null;
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
      task.remindCustomerPhone = patch.remindCustomerPhone ?? null;
    }
    if (patch.status !== undefined) {
      task.status = patch.status;
      task.completedAt = patch.status === 'done' ? new Date() : null;
    }
    return this.tasks.save(task);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const res = await this.tasks.delete({ id, businessId });
    if (!res.affected) throw new NotFoundException('Task not found');
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

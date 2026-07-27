import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { Task, TaskSource, TaskStatus } from './task.entity';

export interface CreateTaskInput {
  businessId: string;
  title: string;
  description?: string | null;
  priority?: Task['priority'];
  dueAt?: string | Date | null;
  source?: TaskSource;
  createdByUserId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
  ) {}

  list(businessId: string, status?: TaskStatus): Promise<Task[]> {
    return this.tasks.find({
      where: { businessId, ...(status ? { status } : {}) },
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
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      createdByUserId: input.createdByUserId ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      status: 'open',
    });
    return this.tasks.save(task);
  }

  async update(
    businessId: string,
    id: string,
    patch: Partial<
      Pick<Task, 'title' | 'description' | 'status' | 'priority'>
    > & { dueAt?: string | Date | null },
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
   * Tasks whose due date has arrived and haven't been reminded yet (and aren't
   * done). Drives the reminders scheduler — cross-tenant, so no businessId scope.
   */
  findDueUnnotified(now: Date = new Date()): Promise<Task[]> {
    return this.tasks.find({
      where: {
        dueAt: LessThanOrEqual(now),
        notifiedAt: IsNull(),
        status: Not('done'),
      },
      order: { dueAt: 'ASC' },
      take: 200,
    });
  }

  /** Stamp a task as reminded so it never double-fires. */
  async markNotified(id: string): Promise<void> {
    await this.tasks.update({ id }, { notifiedAt: new Date() });
  }
}

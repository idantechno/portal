import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TasksService } from './tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TASK_REMINDERS_QUEUE } from './task-reminders.constants';

/**
 * Fires reminders for tasks whose due date has arrived. Runs as a BullMQ
 * repeatable job every 5 minutes; the sweep is idempotent — each task is stamped
 * `notifiedAt` once delivered, so it never double-fires. Delivery goes through
 * the notifications hub: always the in-app bell, plus email (WhatsApp is added
 * once an approved template exists). Push rides along automatically for any
 * business whose owner has opted in.
 */
@Injectable()
export class TaskRemindersService implements OnModuleInit {
  private readonly log = new Logger(TaskRemindersService.name);

  constructor(
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    @InjectQueue(TASK_REMINDERS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // BullMQ dedupes repeatable jobs by their repeat options, so re-adding on
    // every boot doesn't stack duplicates.
    try {
      await this.queue.add(
        'sweep',
        {},
        { repeat: { pattern: '*/5 * * * *' }, removeOnComplete: true },
      );
    } catch (err) {
      this.log.error(
        `Failed to schedule task-reminders sweep: ${(err as Error).message}`,
      );
    }
  }

  /** Deliver a reminder for every due, not-yet-notified task. Returns the count. */
  async sweep(): Promise<number> {
    const due = await this.tasks.findDueUnnotified();
    let sent = 0;
    for (const task of due) {
      try {
        await this.notifications.notify({
          businessId: task.businessId,
          type: 'task',
          title: `תזכורת: ${task.title}`,
          body: task.description ?? 'הגיע מועד היעד של המשימה.',
          link: `/app/businesses/${task.businessId}/tasks`,
          // In-app is always recorded; email adds the external nudge. WhatsApp
          // is intentionally omitted until an approved template lands.
          channels: ['email', 'push'],
        });
        await this.tasks.markNotified(task.id);
        sent += 1;
      } catch (err) {
        // One bad task must not stall the whole sweep.
        this.log.warn(
          `Reminder for task ${task.id} failed: ${(err as Error).message}`,
        );
      }
    }
    if (sent > 0) this.log.log(`Fired ${sent} task reminder(s).`);
    return sent;
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TasksService } from './tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
import { WhatsappConnectionsService } from '../whatsapp/whatsapp-connections.service';
import { Task } from './task.entity';
import { TASK_REMINDERS_QUEUE } from './task-reminders.constants';

/** The approved WhatsApp Utility template that carries every reminder. */
const REMINDER_TEMPLATE = { name: 'reminder', languageCode: 'he' };

/** Formats an instant as friendly Israel wall-clock time for a reminder body. */
function israelWhen(at: Date): string {
  return at.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * WhatsApp rejects template parameters containing newlines, tabs, or 4+
 * consecutive spaces. Collapse any whitespace run to a single space and trim.
 * Also guarantees a non-empty value (Meta rejects empty params).
 */
function param(value: string | null | undefined, fallback: string): string {
  const cleaned = (value ?? '').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

/** First name only, for a warmer greeting ("היי דנה" not "היי דנה כהן"). */
function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * Fires reminders for reminder-enabled tasks whose fire time has arrived. Runs
 * as a BullMQ repeatable job every 5 minutes; the sweep is idempotent — each
 * task is stamped `notifiedAt` once delivered, so it never double-fires.
 *
 * Delivery is layered: the in-app bell + email + push always go to the owner,
 * AND — the point of this agent — a personal WhatsApp reminder via the approved
 * `reminder_generic` template goes to the owner's private number and, for
 * appointment/session reminders, to the customer's number too. WhatsApp is
 * best-effort: a missing connection or unapproved template never stalls the
 * sweep or the other channels.
 */
@Injectable()
export class TaskRemindersService implements OnModuleInit {
  private readonly log = new Logger(TaskRemindersService.name);

  constructor(
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    private readonly businesses: BusinessesService,
    private readonly users: UsersService,
    private readonly whatsapp: WhatsappConnectionsService,
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
    const due = await this.tasks.findDueReminders();
    let sent = 0;
    for (const task of due) {
      try {
        await this.notifications.notify({
          businessId: task.businessId,
          type: 'task',
          title: `תזכורת: ${task.title}`,
          body: task.description ?? 'הגיע מועד התזכורת.',
          link: `/app/businesses/${task.businessId}/calendar?view=reminders`,
          // In-app is always recorded; email + push add the external nudge.
          channels: ['email', 'push'],
        });
        // The point of the reminders agent: a personal WhatsApp reminder.
        await this.deliverWhatsapp(task);
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

  /**
   * Sends the WhatsApp reminder to the owner and, when set, the customer. The
   * event time shown is the task's `dueAt` (when the thing happens), NOT its
   * remind time. Best-effort per recipient — never throws.
   */
  private async deliverWhatsapp(task: Task): Promise<void> {
    const business = await this.businesses.findById(task.businessId);
    if (!business) return;
    const businessName = param(business.name, 'העסק');
    const whenAt = task.dueAt ?? task.remindAt;
    const when = whenAt ? israelWhen(whenAt) : 'בקרוב';

    // Owner reminder — greet by the owner's first name, describe the task itself.
    if (business.ownerPhone) {
      const owner = await this.users
        .findById(business.ownerUserId)
        .catch(() => null);
      const ownerName = param(firstName(owner?.name), 'שלום');
      await this.sendReminder(business.id, business.ownerPhone, [
        ownerName,
        param(task.title, 'תזכורת'),
        param(when, 'בקרוב'),
        businessName,
      ]);
    }

    // Customer reminder — only when this task carries a customer number (e.g. an
    // appointment). The "what" is phrased from the customer's side.
    if (task.remindCustomerPhone) {
      const customerName = param(firstName(task.remindCustomerName), 'שלום');
      await this.sendReminder(business.id, task.remindCustomerPhone, [
        customerName,
        param(`הפגישה שלך עם ${businessName}`, 'הפגישה שלך'),
        param(when, 'בקרוב'),
        businessName,
      ]);
    }
  }

  private async sendReminder(
    businessId: string,
    to: string,
    bodyParams: string[],
  ): Promise<void> {
    try {
      await this.whatsapp.sendTemplate(businessId, to, {
        name: REMINDER_TEMPLATE.name,
        languageCode: REMINDER_TEMPLATE.languageCode,
        bodyParams,
      });
    } catch (err) {
      this.log.warn(
        `[reminders] WhatsApp reminder to ${to} not delivered ` +
          `(business ${businessId}): ${(err as Error).message}`,
      );
    }
  }
}

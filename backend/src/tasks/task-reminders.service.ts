import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TasksService } from './tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
import { WhatsappConnectionsService } from '../whatsapp/whatsapp-connections.service';
import { TemplatesService } from '../templates/templates.service';
import { Task } from './task.entity';
import { TASK_REMINDERS_QUEUE } from './task-reminders.constants';

/**
 * The approved WhatsApp Utility template for reminders that fire *ahead* of the
 * event they point to (a 14:00 task nudged at 12:30). It carries the event's
 * time, so the recipient knows when the thing actually happens.
 */
const REMINDER_TEMPLATE = { name: 'reminder', languageCode: 'he' };

/**
 * The approved template for reminders that fire *at the moment itself* — a pure
 * reminder (`kind='reminder'`), a reminder with no due date, or a task whose
 * remind time equals its due time. It carries NO time: the event is "now", so
 * printing a time would just duplicate it. Rides on the same `reminder` grant.
 */
const REMINDER_NOW_TEMPLATE = { name: 'reminder_now1', languageCode: 'he' };

/**
 * A reminder carries the event's time only when it fires strictly *before* that
 * event. A pure reminder, one with no due date, or one whose remind time equals
 * its due time is happening right now — so it uses the no-time template.
 */
function firesAheadOfEvent(task: Task): boolean {
  return (
    task.kind === 'task' &&
    task.dueAt != null &&
    task.remindAt != null &&
    task.remindAt.getTime() < task.dueAt.getTime()
  );
}

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
 * as a BullMQ repeatable job every minute so a reminder set for a specific
 * minute goes out within that minute (not up to 5 late). The sweep is
 * idempotent — each task is stamped `notifiedAt` once delivered, so it never
 * double-fires even if two ticks overlap.
 *
 * Delivery is layered: the in-app bell + email + push always go to the owner,
 * AND — the point of this agent — a personal WhatsApp reminder via the approved
 * reminder templates goes to the owner's private number and, for
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
    private readonly templates: TemplatesService,
    @InjectQueue(TASK_REMINDERS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // BullMQ keys a repeatable by its pattern, so changing the cadence leaves
    // the OLD schedule (e.g. the previous */5) alive in Redis and firing next
    // to the new one. Clear every existing repeat first, then register the
    // current one — so exactly one schedule runs after a cadence change.
    try {
      const existing = await this.queue.getRepeatableJobs();
      for (const job of existing) {
        await this.queue.removeRepeatableByKey(job.key);
      }
      await this.queue.add(
        'sweep',
        {},
        { repeat: { pattern: '* * * * *' }, removeOnComplete: true },
      );
    } catch (err) {
      this.log.error(
        `Failed to schedule task-reminders sweep: ${(err as Error).message}`,
      );
    }
  }

  /** Deliver a reminder for every due, not-yet-notified task. Returns the count. */
  async sweep(): Promise<number> {
    // Housekeeping: clear completed tasks/reminders older than 48h so the
    // "בוצעו" list self-empties. The sweep runs every minute now, so gate this
    // to the top and bottom of the hour — no point delete-scanning 60×/hour.
    // Best-effort — never blocks reminder delivery.
    if (new Date().getMinutes() % 30 === 0) {
      try {
        const purged = await this.tasks.purgeCompleted();
        if (purged > 0) this.log.log(`Purged ${purged} completed task(s).`);
      } catch (err) {
        this.log.warn(`Completed-task purge failed: ${(err as Error).message}`);
      }
    }

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
    // The reminder feature is granted per business via the base `reminder`
    // template — both the timed and the no-time variant ride on that one grant.
    if (
      !(await this.templates.hasAccess(task.businessId, REMINDER_TEMPLATE.name))
    ) {
      return;
    }
    const business = await this.businesses.findById(task.businessId);
    if (!business) return;
    const businessName = param(business.name, 'העסק');

    // Timed template only when the reminder fires ahead of the event it points
    // to; otherwise the no-time template (the event is happening right now).
    const template = firesAheadOfEvent(task)
      ? REMINDER_TEMPLATE
      : REMINDER_NOW_TEMPLATE;
    const whenAt = task.dueAt ?? task.remindAt;
    const when = whenAt ? israelWhen(whenAt) : 'בקרוב';

    // Body params per template: the no-time variant drops the "when" slot —
    // [name, subject, business] vs the timed [name, subject, when, business].
    const buildParams = (name: string, subject: string): string[] =>
      template === REMINDER_TEMPLATE
        ? [name, subject, param(when, 'בקרוב'), businessName]
        : [name, subject, businessName];

    // Owner reminder — honour the owner's channel choice + configured number
    // (falls back to ownerPhone). Greet by first name, describe the task itself.
    const prefs = await this.notifications.effectivePreferences(
      task.businessId,
    );
    if (prefs.whatsapp && prefs.whatsappTo) {
      const owner = await this.users
        .findById(business.ownerUserId)
        .catch(() => null);
      const ownerName = param(firstName(owner?.name), 'שלום');
      await this.sendReminder(
        business.id,
        prefs.whatsappTo,
        template,
        buildParams(ownerName, param(task.title, 'תזכורת')),
      );
    }

    // Customer reminder — only when this task carries a customer number.
    if (task.remindCustomerPhone) {
      const customerName = param(firstName(task.remindCustomerName), 'שלום');
      // Appointment reminders keep the customer-facing "your appointment with X"
      // wording. Every OTHER reminder carries the owner's own text (the task
      // title) so it can say anything — "call the electric company", "your order
      // is ready", etc. — not just a meeting.
      const subject =
        task.relatedType === 'appointment'
          ? `הפגישה שלך עם ${businessName}`
          : task.title;
      await this.sendReminder(
        business.id,
        task.remindCustomerPhone,
        template,
        buildParams(customerName, param(subject, 'תזכורת')),
      );
    }
  }

  private async sendReminder(
    businessId: string,
    to: string,
    template: { name: string; languageCode: string },
    bodyParams: string[],
  ): Promise<void> {
    try {
      await this.whatsapp.sendTemplate(businessId, to, {
        name: template.name,
        languageCode: template.languageCode,
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

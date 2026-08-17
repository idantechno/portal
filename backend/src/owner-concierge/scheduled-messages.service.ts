import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ScheduledMessage } from './scheduled-message.entity';
import { WhatsappConnectionsService } from '../whatsapp/whatsapp-connections.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SCHEDULED_MESSAGES_QUEUE } from './scheduled-messages.constants';

/** Formats an instant as friendly Israel wall-clock time for owner-facing text. */
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
 * Delivers the outbound WhatsApp messages the owner scheduled through the
 * concierge ("שלח ללינור מחר ב-20:30 ..."). Runs as a BullMQ repeatable job every
 * minute so a message set for a specific minute goes out within it. Idempotent:
 * each row flips to `sent`/`failed` once processed, so it never double-fires.
 *
 * Delivery is over the business's OWN WhatsApp number via a free-form text send —
 * which WhatsApp only accepts inside the recipient's 24h service window. A cold
 * recipient (never messaged the business) is rejected; the failure is recorded
 * and the owner is alerted so they can send it by hand.
 */
@Injectable()
export class ScheduledMessagesService implements OnModuleInit {
  private readonly log = new Logger(ScheduledMessagesService.name);

  constructor(
    @InjectRepository(ScheduledMessage)
    private readonly messages: Repository<ScheduledMessage>,
    private readonly whatsapp: WhatsappConnectionsService,
    private readonly notifications: NotificationsService,
    @InjectQueue(SCHEDULED_MESSAGES_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Register exactly one repeatable sweep — clear any stale schedule first so a
    // cadence change never leaves the old pattern firing alongside the new one.
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
        `Failed to schedule scheduled-messages sweep: ${(err as Error).message}`,
      );
    }
  }

  /** Persist a future outbound message; the sweep delivers it when due. */
  async schedule(input: {
    businessId: string;
    toPhone: string;
    toName?: string | null;
    body: string;
    sendAt: Date;
  }): Promise<ScheduledMessage> {
    return this.messages.save(
      this.messages.create({
        businessId: input.businessId,
        toPhone: input.toPhone,
        toName: input.toName ?? null,
        body: input.body,
        sendAt: input.sendAt,
        status: 'pending',
      }),
    );
  }

  /**
   * Send a WhatsApp text to a contact right now, recording it as a `sent`/`failed`
   * row for the audit trail. Returns whether it was delivered. Never throws —
   * a rejected send (e.g. recipient outside the 24h window) resolves `false`.
   */
  async sendNow(input: {
    businessId: string;
    toPhone: string;
    toName?: string | null;
    body: string;
  }): Promise<{ delivered: boolean; error?: string }> {
    const row = await this.messages.save(
      this.messages.create({
        businessId: input.businessId,
        toPhone: input.toPhone,
        toName: input.toName ?? null,
        body: input.body,
        sendAt: new Date(),
        status: 'pending',
      }),
    );
    return this.deliver(row);
  }

  /** Deliver every due, still-pending message. Returns the count delivered. */
  async sweep(): Promise<number> {
    const due = await this.messages.find({
      where: { status: 'pending', sendAt: LessThanOrEqual(new Date()) },
      order: { sendAt: 'ASC' },
      take: 100,
    });
    let sent = 0;
    for (const row of due) {
      const result = await this.deliver(row);
      if (result.delivered) sent += 1;
    }
    if (sent > 0) this.log.log(`Delivered ${sent} scheduled message(s).`);
    return sent;
  }

  /**
   * Attempts one send and records the outcome. On failure, flags the row and
   * alerts the owner (in-app + push) with the recipient and full text so they can
   * send it manually. Best-effort — a bad row never stalls the sweep.
   */
  private async deliver(
    row: ScheduledMessage,
  ): Promise<{ delivered: boolean; error?: string }> {
    try {
      const res = await this.whatsapp.sendText(
        row.businessId,
        row.toPhone,
        row.body,
      );
      row.status = 'sent';
      row.sentAt = new Date();
      row.wamid = res.externalMessageId ?? null;
      await this.messages.save(row);
      return { delivered: true };
    } catch (err) {
      const reason = (err as Error).message.slice(0, 500);
      row.status = 'failed';
      row.failureReason = reason;
      await this.messages.save(row).catch(() => undefined);
      this.log.warn(
        `Scheduled message ${row.id} to ${row.toPhone} not delivered: ${reason}`,
      );
      await this.alertOwnerOfFailure(row);
      return { delivered: false, error: reason };
    }
  }

  /** Tell the owner a scheduled message couldn't be delivered — with the text. */
  private async alertOwnerOfFailure(row: ScheduledMessage): Promise<void> {
    const who = row.toName?.trim() || row.toPhone;
    try {
      await this.notifications.notify({
        businessId: row.businessId,
        type: 'task',
        title: `לא נשלחה הודעה ל${who}`,
        body:
          `וואטסאפ חסם שליחת טקסט חופשי (הנמען לא כתב לעסק ב-24 השעות האחרונות). ` +
          `ההודעה: "${row.body}" — כדאי לשלוח ידנית ל-${row.toPhone}.`,
        link: '/calendar',
        channels: ['push'],
      });
    } catch (err) {
      this.log.warn(
        `Owner failure-alert for scheduled message ${row.id} not sent: ` +
          `${(err as Error).message}`,
      );
    }
  }

  /** Upcoming (still-pending) scheduled messages for a business, soonest first. */
  listPending(businessId: string): Promise<ScheduledMessage[]> {
    return this.messages.find({
      where: { businessId, status: 'pending' },
      order: { sendAt: 'ASC' },
      take: 100,
    });
  }

  /** Human-readable "מחר, שבת 20:30" for a confirmation line. */
  static whenLabel(at: Date): string {
    return israelWhen(at);
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';

/** Channels a notification can be delivered over besides the always-on in-app. */
export type DeliveryChannel = 'email' | 'whatsapp' | 'push';

export interface NotifyInput {
  businessId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  /** External channels to ALSO deliver over. In-app is always recorded. */
  channels?: DeliveryChannel[];
}

/**
 * Notifications hub. `notify()` always records an in-app notification (the bell)
 * and optionally fans out to external channels. External delivery is stubbed
 * until credentials are wired (SMTP for email, the WhatsApp Cloud API token for
 * WhatsApp, web-push keys for push) — those land in the operator's env, so for
 * now the dispatcher logs what it *would* send. This keeps automations able to
 * declare `channels: ['whatsapp']` today without blocking on setup.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  async notify(input: NotifyInput): Promise<Notification> {
    const row = await this.notifications.save(
      this.notifications.create({
        businessId: input.businessId,
        userId: input.userId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        read: false,
      }),
    );
    for (const channel of input.channels ?? []) {
      this.deliverExternal(channel, input);
    }
    return row;
  }

  // Placeholder until provider credentials exist. Intentionally non-throwing so
  // a missing integration never breaks the originating action.
  private deliverExternal(channel: DeliveryChannel, input: NotifyInput): void {
    this.log.warn(
      `[notifications] external channel "${channel}" not configured yet — ` +
        `would send to business ${input.businessId}: ${input.title}`,
    );
  }

  list(
    businessId: string,
    opts: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<Notification[]> {
    return this.notifications.find({
      where: { businessId, ...(opts.unreadOnly ? { read: false } : {}) },
      order: { createdAt: 'DESC' },
      take: opts.limit ?? 50,
    });
  }

  unreadCount(businessId: string): Promise<number> {
    return this.notifications.count({ where: { businessId, read: false } });
  }

  async markRead(businessId: string, id: string): Promise<Notification> {
    const row = await this.notifications.findOne({ where: { id, businessId } });
    if (!row) throw new NotFoundException('Notification not found');
    row.read = true;
    return this.notifications.save(row);
  }

  async markAllRead(businessId: string): Promise<{ updated: number }> {
    const res = await this.notifications.update(
      { businessId, read: false },
      { read: true },
    );
    return { updated: res.affected ?? 0 };
  }
}

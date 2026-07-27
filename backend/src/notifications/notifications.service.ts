import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { Notification, NotificationType } from './notification.entity';
import { PushSubscription } from './push-subscription.entity';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
import { GmailService } from '../integrations/gmail.service';

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

/** A browser/PWA's push subscription as sent up from the client. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
}

/**
 * Notifications hub. `notify()` always records an in-app notification (the bell)
 * and optionally fans out to external channels:
 * - email  → the business's connected Gmail sends to the target/owner (skipped
 *            silently if Gmail isn't connected).
 * - push   → Web Push to the business's opted-in PWAs/browsers (skipped if no
 *            VAPID keys are configured).
 * - whatsapp → still a logged stub: the send path exists, but reliable owner
 *            reminders need an approved WhatsApp template first, so it's held.
 * External delivery is fire-and-forget and never throws — a missing integration
 * must never break the action that raised the notification.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly log = new Logger(NotificationsService.name);
  private vapidReady = false;

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(PushSubscription)
    private readonly pushSubs: Repository<PushSubscription>,
    private readonly config: ConfigService,
    private readonly businesses: BusinessesService,
    private readonly users: UsersService,
    private readonly gmail: GmailService,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (publicKey && privateKey) {
      const subject =
        this.config.get<string>('VAPID_SUBJECT') ||
        'mailto:idantechno@gmail.com';
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.vapidReady = true;
      this.log.log('Web Push enabled (VAPID configured).');
    } else {
      this.log.log('Web Push disabled — no VAPID keys configured.');
    }
  }

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
      // Fire-and-forget: delivery must not block or break the caller.
      void this.deliverExternal(channel, input);
    }
    return row;
  }

  /** The VAPID public key the frontend needs to subscribe (empty if disabled). */
  vapidPublicKey(): string {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
  }

  /** Upsert a device's push subscription (keyed by its unique endpoint). */
  async subscribePush(
    businessId: string,
    userId: string | null,
    sub: PushSubscriptionInput,
  ): Promise<void> {
    const existing = await this.pushSubs.findOne({
      where: { endpoint: sub.endpoint },
    });
    if (existing) {
      existing.businessId = businessId;
      existing.userId = userId;
      existing.p256dh = sub.keys.p256dh;
      existing.auth = sub.keys.auth;
      existing.userAgent = sub.userAgent ?? existing.userAgent ?? null;
      await this.pushSubs.save(existing);
      return;
    }
    await this.pushSubs.save(
      this.pushSubs.create({
        businessId,
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: sub.userAgent ?? null,
      }),
    );
  }

  async unsubscribePush(endpoint: string): Promise<void> {
    await this.pushSubs.delete({ endpoint });
  }

  // Never throws — logs and returns. See class docstring.
  private async deliverExternal(
    channel: DeliveryChannel,
    input: NotifyInput,
  ): Promise<void> {
    try {
      if (channel === 'email') return await this.deliverEmail(input);
      if (channel === 'push') return await this.deliverPush(input);
      // 'whatsapp' — send path exists (WhatsappConnectionsService) but held
      // until an approved template covers cold owner reminders.
      this.log.warn(
        `[notifications] whatsapp delivery held (needs approved template) — ` +
          `would send to business ${input.businessId}: ${input.title}`,
      );
    } catch (err) {
      this.log.warn(
        `[notifications] ${channel} delivery failed for business ` +
          `${input.businessId}: ${(err as Error).message}`,
      );
    }
  }

  private async deliverEmail(input: NotifyInput): Promise<void> {
    const business = await this.businesses.findById(input.businessId);
    if (!business) return;
    // Target the specific user if the notification is user-scoped, else the owner.
    let email: string | null = null;
    if (input.userId) {
      email = (await this.users.findById(input.userId))?.email ?? null;
    }
    if (!email) {
      email = (await this.users.findById(business.ownerUserId))?.email ?? null;
    }
    if (!email) return;
    const appUrl = this.config.get<string>(
      'APP_URL',
      'https://app.portalstudio.co.il',
    );
    const body = [
      input.body ?? input.title,
      input.link ? `${appUrl}${input.link}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    // Sent via the business's own connected Gmail; throws GMAIL_NOT_CONNECTED
    // (caught in deliverExternal) when the business hasn't connected it.
    await this.gmail.sendEmail(input.businessId, {
      to: email,
      subject: input.title,
      body,
    });
  }

  private async deliverPush(input: NotifyInput): Promise<void> {
    if (!this.vapidReady) return;
    // User-scoped notification → that user's devices; business-wide → all of them.
    const subs = await this.pushSubs.find({
      where: input.userId
        ? { businessId: input.businessId, userId: input.userId }
        : { businessId: input.businessId },
    });
    if (subs.length === 0) return;
    const payload = JSON.stringify({
      title: input.title,
      body: input.body ?? '',
      link: input.link ?? '/',
    });
    await Promise.all(
      subs.map((sub) =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          )
          .catch(async (err: { statusCode?: number }) => {
            // 404/410 = the subscription is dead; prune it.
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await this.pushSubs.delete({ endpoint: sub.endpoint });
            }
          }),
      ),
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

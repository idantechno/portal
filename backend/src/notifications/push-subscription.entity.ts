import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A Web Push subscription for one installed PWA / browser. Created when a user
 * opts into push from the cockpit; targeted by NotificationsService when a
 * notification declares the 'push' channel. Scoped by business (+ optional
 * user) exactly like Notification, so a tenant only ever pushes to its own
 * devices. `endpoint` is unique — re-subscribing the same device upserts.
 */
@Entity({ name: 'push_subscriptions' })
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  /** The push service URL for this device (browser-issued, provider-specific). */
  @Index({ unique: true })
  @Column({ type: 'text' })
  endpoint!: string;

  /** ECDH public key from the subscription's `keys` — for payload encryption. */
  @Column({ type: 'text' })
  p256dh!: string;

  /** Auth secret from the subscription's `keys`. */
  @Column({ type: 'text' })
  auth!: string;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

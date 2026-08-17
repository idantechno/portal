import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Lifecycle of an owner-scheduled outbound message. */
export type ScheduledMessageStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'cancelled';

/**
 * A WhatsApp message the business owner asked the concierge to send to someone
 * else (a customer / lead / any contact) — either right now or at a future time.
 * The minute sweep (`ScheduledMessagesService`) delivers every `pending` row
 * whose `send_at` has arrived, over the business's own WhatsApp number.
 *
 * NOTE: WhatsApp only allows free-form text inside the recipient's 24h service
 * window (they messaged the business number recently). A cold recipient needs an
 * approved template — a free-form scheduled send to them will be rejected, and
 * the sweep records the failure and alerts the owner so they can send by hand.
 */
@Entity({ name: 'scheduled_messages' })
export class ScheduledMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** Recipient's WhatsApp number (E.164 / national — sent as given). */
  @Column({ type: 'varchar', length: 32, name: 'to_phone' })
  toPhone!: string;

  /** Recipient's name, if known — for owner-facing confirmations only. */
  @Column({ type: 'varchar', length: 200, name: 'to_name', nullable: true })
  toName!: string | null;

  /** The message body to send. */
  @Column({ type: 'text' })
  body!: string;

  /** When to send it (Israel wall-clock, stored as an instant). */
  @Index()
  @Column({ type: 'timestamptz', name: 'send_at' })
  sendAt!: Date;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ScheduledMessageStatus;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt!: Date | null;

  /** Why delivery failed (WhatsApp error), for the owner alert + audit. */
  @Column({ type: 'text', name: 'failure_reason', nullable: true })
  failureReason!: string | null;

  /** WhatsApp message id once delivered. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  wamid!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

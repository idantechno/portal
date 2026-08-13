import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One row per command the business owner sent to the agent over WhatsApp (their
 * own number → the business number). Serves two purposes: an audit trail of what
 * the owner asked the concierge to do, and — via the unique `wamid` — idempotency
 * so a re-delivered webhook never runs the same command (and its side effects)
 * twice. These are NOT customer conversations and never appear in the Inbox.
 */
@Entity({ name: 'owner_commands' })
export class OwnerCommand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 32, name: 'from_phone' })
  fromPhone!: string;

  /** WhatsApp message id — unique so a retried webhook is a no-op. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  wamid!: string;

  /** What the owner sent. */
  @Column({ type: 'text' })
  body!: string;

  /** The agent's reply back to the owner (filled once the run completes). */
  @Column({ type: 'text', nullable: true })
  reply!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

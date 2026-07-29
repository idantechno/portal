import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Where a detected mail item is in the owner-approval lifecycle. */
export type MailItemStatus = 'pending' | 'approved' | 'dismissed';

/**
 * One email the mail agent flagged as worth the owner's attention (today: an
 * invoice/receipt candidate). Nothing is filed automatically: a row lands as
 * `pending` in the approval queue and only becomes an {@link Expense} when the
 * owner approves it. The composite unique index on (business_id,
 * gmail_message_id) makes the every-30-min sweep idempotent — the same Gmail
 * message can never be enqueued twice for the same business.
 */
@Index(['businessId', 'gmailMessageId'], { unique: true })
@Entity({ name: 'mail_items' })
export class MailItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** The Gmail message id — unique per business (dedupe key). */
  @Column({ type: 'varchar', name: 'gmail_message_id' })
  gmailMessageId!: string;

  /** Which detector matched (e.g. 'invoice'). Keeps the engine extensible. */
  @Column({ type: 'varchar', length: 24 })
  detector!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: MailItemStatus;

  @Column({ type: 'varchar', name: 'from_address' })
  fromAddress!: string;

  @Column({ type: 'varchar' })
  subject!: string;

  @Column({ type: 'text', nullable: true })
  snippet!: string | null;

  @Column({ type: 'timestamptz', name: 'received_at' })
  receivedAt!: Date;

  @Column({ type: 'boolean', name: 'has_attachment', default: false })
  hasAttachment!: boolean;

  @Column({ type: 'varchar', name: 'attachment_name', nullable: true })
  attachmentName!: string | null;

  @Column({ type: 'varchar', name: 'attachment_id', nullable: true })
  attachmentId!: string | null;

  @Column({ type: 'varchar', name: 'attachment_mime', nullable: true })
  attachmentMime!: string | null;

  /** Set once the owner approves and the item is filed as an expense. */
  @Column({ type: 'uuid', name: 'expense_id', nullable: true })
  expenseId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

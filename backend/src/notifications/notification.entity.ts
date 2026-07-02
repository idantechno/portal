import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Loose category — drives the icon/colour in the UI and lets rules filter. */
export type NotificationType =
  | 'lead'
  | 'message'
  | 'task'
  | 'document'
  | 'billing'
  | 'automation'
  | 'system';

/**
 * An in-app notification shown in the cockpit bell. External delivery (email,
 * WhatsApp, push) is handled by the dispatcher; this row is the in-app record
 * and the source of truth for the unread badge.
 */
@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** Null = visible to everyone in the business (not user-targeted). */
  @Index()
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'system' })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  /** Optional in-app deep link, e.g. `/app/businesses/<id>/leads`. */
  @Column({ type: 'varchar', length: 512, nullable: true })
  link!: string | null;

  @Index()
  @Column({ type: 'boolean', default: false })
  read!: boolean;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

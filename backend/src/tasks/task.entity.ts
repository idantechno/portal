import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TaskStatus = 'open' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
/** Where the task came from — manual, an automation rule, or an agent. */
export type TaskSource = 'manual' | 'automation' | 'agent';

/**
 * A unit of work in the business cockpit. Tasks can be created by a person, by
 * an automation rule, or by an agent (e.g. "follow up with this lead"). Scoped
 * by businessId like every tenant resource.
 */
@Entity({ name: 'tasks' })
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'open' })
  status!: TaskStatus;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  priority!: TaskPriority;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source!: TaskSource;

  @Column({ type: 'timestamptz', name: 'due_at', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  /** Optional link back to a domain object (lead, conversation, document...). */
  @Column({ type: 'varchar', length: 32, name: 'related_type', nullable: true })
  relatedType!: string | null;

  @Column({ type: 'uuid', name: 'related_id', nullable: true })
  relatedId!: string | null;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

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
 * What this row IS. Tasks and reminders share one table; `kind` is what splits
 * the two calendar tabs:
 *  - `task`     — a to-do the owner tracks (the "משימות" list). It may ALSO opt
 *                 into a reminder (`remindEnabled`), in which case it appears in
 *                 the reminders tab too.
 *  - `reminder` — a pure time-nudge that is NOT a to-do (the "תזכורות" list):
 *                 the reminders agent, an appointment, or another agent (e.g.
 *                 the chat agent) created it. Always `remindEnabled`.
 */
export type TaskKind = 'task' | 'reminder';

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

  /** Task (a to-do) vs reminder (a pure nudge). See {@link TaskKind}. */
  @Index()
  @Column({ type: 'varchar', length: 16, default: 'task' })
  kind!: TaskKind;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'open' })
  status!: TaskStatus;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  priority!: TaskPriority;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source!: TaskSource;

  @Column({ type: 'timestamptz', name: 'due_at', nullable: true })
  dueAt!: Date | null;

  /**
   * Master switch for the reminders agent. The reminders sweep only fires a
   * WhatsApp/bell reminder for this task when true. Manual tasks default OFF —
   * the owner opts a task in with the 🔔 toggle; reminders the agent or an
   * appointment created come in already ON. "What isn't marked isn't reminded."
   */
  @Column({ type: 'boolean', name: 'remind_enabled', default: false })
  remindEnabled!: boolean;

  /**
   * WHEN to fire the reminder — deliberately distinct from `dueAt` (when the
   * event itself happens). A 12:00 appointment can remind at 08:00; a "collect
   * gear" task at 12:00 can remind two hours before at 10:00. Null falls back to
   * `dueAt` (remind exactly at the due time).
   */
  @Column({ type: 'timestamptz', name: 'remind_at', nullable: true })
  remindAt!: Date | null;

  /**
   * Optional extra WhatsApp recipient — the customer's own number (E.164) — so
   * the same reminder also reaches the customer, not only the owner. Set for
   * appointment/session reminders; null for the owner's private tasks. Varies
   * per reminder (a different customer each time).
   */
  @Column({
    type: 'varchar',
    length: 32,
    name: 'remind_customer_phone',
    nullable: true,
  })
  remindCustomerPhone!: string | null;

  /** Customer's display name, to personalize their reminder ("היי דנה 🙂"). */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'remind_customer_name',
    nullable: true,
  })
  remindCustomerName!: string | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  /**
   * When the due-date reminder for this task was delivered (bell + email/…).
   * Null = not yet notified. Set by the reminders scheduler so a due task
   * fires exactly once. Reset to null when the due date is moved forward.
   */
  @Column({ type: 'timestamptz', name: 'notified_at', nullable: true })
  notifiedAt!: Date | null;

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

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Where a lead originated. Agent = captured mid-chat via `capture_lead`;
 *  questionnaire = a public marketing questionnaire submission (no conversation). */
export type LeadSource = 'agent' | 'questionnaire';

/**
 * Lead captured either by the agent via the `capture_lead` tool (one row per
 * customer-volunteered contact intent) or by a public marketing questionnaire
 * submission. Surfaces to the business in the leads screen.
 *
 * `conversationId`/`customerContactId` are only set on the agent path — a
 * questionnaire lead has no conversation, so both are nullable.
 */
@Entity({ name: 'leads' })
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'conversation_id', nullable: true })
  conversationId!: string | null;

  @Index()
  @Column({ type: 'uuid', name: 'customer_contact_id', nullable: true })
  customerContactId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'text' })
  interest!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 16, name: 'source', default: 'agent' })
  source!: LeadSource;

  /**
   * Human-readable origin shown in the leads table: which channel, landing page
   * or campaign the lead actually came from — e.g. "וואטסאפ", "צ'אט באתר",
   * "שאלון אסטרטגיה", "שאלון אסטרטגיה · אינסטגרם". Null for older rows.
   */
  @Column({
    type: 'varchar',
    length: 160,
    name: 'source_detail',
    nullable: true,
  })
  sourceDetail!: string | null;

  /** Full structured questionnaire submission (sections + answers). Null for
   *  agent-captured leads. */
  @Column({ type: 'jsonb', name: 'answers', nullable: true })
  answers!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

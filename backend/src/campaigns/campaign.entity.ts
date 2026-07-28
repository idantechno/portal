import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Campaign lifecycle:
 *  - `building` — the 3 stages (marketing plan → production plan → schedule) are
 *    still being assembled.
 *  - `active` — all stages complete, the campaign is live.
 *  - `done` — the campaign has ended.
 */
export type CampaignStatus = 'building' | 'active' | 'done';

/** Schedule horizon chosen in stage C. */
export type ScheduleHorizon = 'monthly' | 'half_year' | 'yearly';

/** One scheduled asset in stage C — a production item placed on a date/channel. */
export interface ScheduleItem {
  /** Stable id so the UI can edit a single item across list + calendar views. */
  id: string;
  title: string;
  kind: string;
  /** Where it publishes. */
  channel: string;
  /** When — ISO datetime (day + time). */
  at: string;
  /** Paid budget for this item, if any (free text). */
  funding: string;
}

/**
 * A marketing campaign run for a customer. Creation is gated behind a hard
 * prerequisite check (brand page, logo, marketing plan, price quote, goals &
 * objectives) — see `campaign-prerequisites.service.ts`.
 *
 * The campaign is built in three stages:
 *   A · marketing plan   — references the customer's existing approved plan
 *   B · production plan   — the list of assets to produce (videos, images, ads,
 *                           texts, formats, versions) — filled in later
 *   C · schedule          — when/where each asset publishes, and any paid budget
 *
 * Stages B and C are stored as JSON for now; they get their own structured build
 * step. `status` advances to `active` once all three are in place.
 */
@Entity({ name: 'campaigns' })
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'customer_id' })
  customerId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 16, default: 'building' })
  status!: CampaignStatus;

  /* -- Stage A: marketing plan (the customer's existing approved plan) ------ */
  @Column({ type: 'uuid', name: 'marketing_plan_id', nullable: true })
  marketingPlanId!: string | null;

  /* -- Stage B: production plan (list of assets to produce) ----------------- */

  /**
   * The owner's answers to the 3 creative questions — the human voice that must
   * be present before the production plan is generated. Guides but never
   * replaces the owner's own words.
   */
  @Column({ type: 'jsonb', name: 'production_answers', nullable: true })
  productionAnswers!: {
    style: string;
    firstScene: string;
    clientPresence: string;
  } | null;

  @Column({ type: 'jsonb', name: 'production_plan', nullable: true })
  productionPlan!: Record<string, unknown> | null;

  /* -- Stage C: schedule ---------------------------------------------------- */
  @Column({
    type: 'varchar',
    length: 16,
    name: 'schedule_horizon',
    nullable: true,
  })
  scheduleHorizon!: ScheduleHorizon | null;

  @Column({ type: 'jsonb', name: 'schedule', nullable: true })
  schedule!: ScheduleItem[] | null;

  /** When the campaign started running — the baseline for status tracking. */
  @Column({ type: 'timestamptz', name: 'launched_at', nullable: true })
  launchedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

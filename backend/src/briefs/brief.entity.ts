import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A brief starts life as a machine draft and is only `approved` once a human
 *  has read the 🟠 fields and signed off on them. */
export type BriefStatus = 'draft' | 'approved';

/**
 * One business brief — the single source-of-truth document generated from a
 * strategy-questionnaire submission.
 *
 * `markdown` is the deliverable (and is editable by the operator, which is why
 * it is stored rather than re-rendered on read). `payload` keeps the three
 * resolved layers behind it — questionnaire facts, website extraction, drafted
 * conclusions, contradictions — so a regeneration can be diffed against what
 * the previous run actually saw.
 */
@Entity({ name: 'briefs' })
export class Brief {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** The questionnaire lead this was generated from. Null once that lead is gone. */
  @Index()
  @Column({ type: 'uuid', name: 'lead_id', nullable: true })
  leadId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  markdown!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: BriefStatus;

  /** Website the 🟢 extraction step was pointed at, if any. */
  @Column({ type: 'varchar', length: 512, name: 'website_url', nullable: true })
  websiteUrl!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  /** True once the operator has edited the markdown by hand. */
  @Column({ type: 'boolean', name: 'edited', default: false })
  edited!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

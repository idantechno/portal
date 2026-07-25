import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Like a brief, a strategy starts life as a machine draft and is only
 *  `approved` once a human has read it and signed off — the gate before it is
 *  ever sent to a client. */
export type StrategyStatus = 'draft' | 'approved';

/**
 * One marketing strategy — the second stage after the brief.
 *
 * A strategy is generated *only* from an already-`approved` brief: the operator
 * signs off on the facts (the brief), and only then is a strategy built on top
 * of them. The strategy itself is again a `draft` that needs its own approval
 * before it leaves the building.
 *
 * `markdown` is the deliverable (editable by the operator, hence stored rather
 * than re-rendered). `payload` keeps the structured draft behind it so a
 * regeneration can be diffed against what the previous run produced.
 */
@Entity({ name: 'strategies' })
export class Strategy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** The approved brief this strategy was derived from. Null once it is gone. */
  @Index()
  @Column({ type: 'uuid', name: 'brief_id', nullable: true })
  briefId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  markdown!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: StrategyStatus;

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

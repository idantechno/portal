import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Like a strategy, a plan is a draft until a human approves it. */
export type PlanStatus = 'draft' | 'approved';

/**
 * One execution / work plan — the third stage after brief → strategy.
 *
 * A plan is generated *only* from an already-`approved` strategy: it turns the
 * strategic decisions into concrete work — workstreams, a period-by-period
 * timeline, milestones and immediate next actions. It is itself a `draft` until
 * approved. Documents chain: `strategyId` links the source strategy, and
 * `customerId` is inherited from it so the plan groups under the same customer.
 */
@Entity({ name: 'plans' })
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** The approved strategy this plan was derived from. Null once it is gone. */
  @Index()
  @Column({ type: 'uuid', name: 'strategy_id', nullable: true })
  strategyId!: string | null;

  /** The customer this plan belongs to — inherited from the source strategy. */
  @Index()
  @Column({ type: 'uuid', name: 'customer_id', nullable: true })
  customerId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  markdown!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: PlanStatus;

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

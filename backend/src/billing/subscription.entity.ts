import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled';

/** How the subscription is billed/collected. */
export type BillingProviderName = 'manual' | 'stripe' | 'greeninvoice';

/** One row per business — its current plan and billing status. */
@Entity({ name: 'subscriptions' })
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('uq_subscription_business', { unique: true })
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 32, name: 'plan_code', default: 'free' })
  planCode!: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: SubscriptionStatus;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  provider!: BillingProviderName;

  /** External id at the provider (Stripe subscription id, etc.). */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_ref',
    nullable: true,
  })
  providerRef!: string | null;

  @Column({
    type: 'timestamptz',
    name: 'current_period_end',
    nullable: true,
  })
  currentPeriodEnd!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

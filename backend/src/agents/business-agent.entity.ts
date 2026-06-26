import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Per-business grant of a catalog agent. A row's absence means "no access"
 * (default deny); enabled=false is an explicit revoke that keeps history.
 */
@Entity({ name: 'business_agents' })
@Index('uq_business_agent', ['businessId', 'agentKey'], { unique: true })
export class BusinessAgent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 32, name: 'agent_key' })
  agentKey!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /** Reserved for future per-agent settings/limits (kept on/off for now). */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config!: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'granted_by_user_id', nullable: true })
  grantedByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

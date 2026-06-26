import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Append-only record of sensitive actions, especially cross-tenant access by
 * platform staff. Never updated or deleted in normal operation.
 */
@Entity({ name: 'audit_events' })
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'actor_email', nullable: true })
  actorEmail!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'actor_role', nullable: true })
  actorRole!: string | null;

  /** Dotted action name, e.g. "business.access", "member.role_changed". */
  @Index()
  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id', nullable: true })
  businessId!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'target_type', nullable: true })
  targetType!: string | null;

  @Column({ type: 'varchar', length: 128, name: 'target_id', nullable: true })
  targetId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type SupportRequestStatus = 'open' | 'resolved';

/**
 * A technical/support request raised by a business (usually via the concierge
 * agent) and routed to platform staff (idant). Cross-tenant: staff read all of
 * them from the admin surface; the business only creates them.
 */
@Entity({ name: 'support_requests' })
export class SupportRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'text' })
  details!: string;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'open' })
  status!: SupportRequestStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt!: Date | null;
}

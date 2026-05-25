import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WhatsappConnectionStatus = 'pending' | 'active' | 'failed';

/**
 * One business ↔ one WABA phone number in Phase 1. Connections are created by
 * Embedded Signup, not credentials-paste — the app secret and webhook verify
 * token live in env (one Meta app for the whole platform), so per-business
 * rows only hold what Embedded Signup actually returns.
 */
@Entity({ name: 'whatsapp_connections' })
export class WhatsappConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 64,
    name: 'phone_number_id',
    nullable: true,
  })
  phoneNumberId!: string | null;

  @Column({ type: 'varchar', length: 64, name: 'waba_id', nullable: true })
  wabaId!: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'meta_business_id',
    nullable: true,
  })
  metaBusinessId!: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'display_phone_number',
    nullable: true,
  })
  displayPhoneNumber!: string | null;

  @Column({ type: 'text', name: 'access_token_encrypted', nullable: true })
  accessTokenEncrypted!: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'pending',
  })
  status!: WhatsappConnectionStatus;

  @Column({ type: 'text', name: 'last_error', nullable: true })
  lastError!: string | null;

  @Column({ type: 'timestamptz', name: 'connected_at', nullable: true })
  connectedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

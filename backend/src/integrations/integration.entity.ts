import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type IntegrationProvider = 'gmail' | 'calendar' | 'drive';
export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

/**
 * A business's connection to an external Google service. OAuth tokens are
 * stored encrypted (AES-GCM via CryptoService) and never returned to the
 * client. One row per (business, provider).
 */
@Entity({ name: 'integrations' })
@Index('uq_integration_business_provider', ['businessId', 'provider'], {
  unique: true,
})
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 16 })
  provider!: IntegrationProvider;

  @Column({ type: 'varchar', length: 16, default: 'disconnected' })
  status!: IntegrationStatus;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'account_email',
    nullable: true,
  })
  accountEmail!: string | null;

  /** Encrypted JSON of the OAuth token set. Never serialized to the client. */
  @Column({ type: 'text', name: 'encrypted_tokens', nullable: true })
  encryptedTokens!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  scopes!: string[];

  @Column({ type: 'timestamptz', name: 'connected_at', nullable: true })
  connectedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

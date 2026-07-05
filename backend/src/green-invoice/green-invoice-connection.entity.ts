import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type GreenInvoiceEnv = 'sandbox' | 'production';
export type GreenInvoiceStatus = 'connected' | 'disconnected';

/**
 * Per-business connection to חשבונית ירוקה (Green Invoice / "Morning"). Each
 * business issues invoices under ITS OWN account, so credentials are stored
 * per business (encrypted, never returned to the client). One row per business.
 */
@Entity({ name: 'green_invoice_connections' })
export class GreenInvoiceConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('uq_green_invoice_business', { unique: true })
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** Encrypted JSON of { id, secret } (the Green Invoice API key pair). */
  @Column({ type: 'text', name: 'encrypted_credentials', nullable: true })
  encryptedCredentials!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'sandbox' })
  environment!: GreenInvoiceEnv;

  @Column({ type: 'varchar', length: 16, default: 'disconnected' })
  status!: GreenInvoiceStatus;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'account_name',
    nullable: true,
  })
  accountName!: string | null;

  @Column({ type: 'timestamptz', name: 'connected_at', nullable: true })
  connectedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

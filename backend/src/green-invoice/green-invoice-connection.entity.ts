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
 * The issuing business's VAT registration. Decides which legal document we ask
 * Green Invoice to produce: an עוסק פטור issues a קבלה (receipt, type 400); an
 * עוסק מורשה issues a חשבונית מס/קבלה (tax invoice + receipt, type 320). It is a
 * stable trait of the business, captured once at connect time — never a
 * per-invoice choice, since issuing the wrong document type is a legal problem.
 */
export type TaxStatus = 'exempt' | 'licensed';

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

  /** עוסק פטור → קבלה (400); עוסק מורשה → חשבונית מס/קבלה (320). */
  @Column({
    type: 'varchar',
    length: 16,
    name: 'tax_status',
    default: 'exempt',
  })
  taxStatus!: TaxStatus;

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

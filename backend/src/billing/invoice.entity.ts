import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

/**
 * A customer-facing invoice produced for a business's own client (the
 * Accounting Agent generates these; they can also be created by hand). Distinct
 * from Portal Studio billing the business for its subscription.
 */
@Entity({ name: 'invoices' })
// Invoice numbers must be unique within a business — a duplicate is a legal
// problem, not just a UI glitch.
@Index('uq_invoice_number', ['businessId', 'number'], { unique: true })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 32 })
  number!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: InvoiceStatus;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'customer_name',
    nullable: true,
  })
  customerName!: string | null;

  @Column({ type: 'int', name: 'amount_cents', default: 0 })
  amountCents!: number;

  @Column({ type: 'varchar', length: 8, default: 'ILS' })
  currency!: string;

  @Column({ type: 'jsonb', name: 'line_items', default: () => "'[]'::jsonb" })
  lineItems!: InvoiceLineItem[];

  @Column({ type: 'timestamptz', name: 'issued_at', nullable: true })
  issuedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'due_at', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'varchar', length: 512, name: 'pdf_url', nullable: true })
  pdfUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** fixed = a recurring monthly bill (electricity, water, arnona, rent…).
 *  occasional = a one-off purchase. */
export type ExpenseKind = 'fixed' | 'occasional';
/** parsed = amount read from the file by AI; manual = user-entered;
 *  failed = AI couldn't read an amount (awaiting manual fix); pending = mid-parse. */
export type ExpenseStatus = 'parsed' | 'manual' | 'failed' | 'pending';

@Entity({ name: 'expenses' })
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** Vendor / short description (e.g. "חשמל — חברת החשמל"). */
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 16, default: 'occasional' })
  kind!: ExpenseKind;

  @Column({ type: 'int', name: 'amount_cents', nullable: true })
  amountCents!: number | null;

  @Column({ type: 'varchar', length: 8, default: 'ILS' })
  currency!: string;

  /** The date printed on the document. */
  @Column({ type: 'date', name: 'expense_date', nullable: true })
  expenseDate!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'file_name', nullable: true })
  fileName!: string | null;

  /** Path under BUSINESSES_DIR/<business_id>/ — managed by FilesystemService. */
  @Column({
    type: 'varchar',
    length: 512,
    name: 'relative_path',
    nullable: true,
  })
  relativePath!: string | null;

  @Column({ type: 'varchar', length: 128, name: 'mime_type', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'int', nullable: true })
  size!: number | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ExpenseStatus;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A quote is a draft until the operator approves it (the campaign gate wants
 *  an approved quote). */
export type QuoteStatus = 'draft' | 'approved';

/** One marketing channel line inside the quote. */
export interface QuoteChannel {
  /** Channel name, e.g. "אינסטגרם ממומן". */
  name: string;
  /** What's done on it. */
  description: string;
  /** Budget for this channel (free text — "₪2,000/חודש"). */
  budget: string;
}

/**
 * A marketing price quote for a customer — the "הצעת מחיר" prerequisite of a
 * campaign. Authored at the quote agent (not the marketing agent) and linked to
 * the customer, where it surfaces among the customer's marketing reports.
 *
 * It is an operator-filled structured document (not model-generated): three
 * defined sections — customer journey, marketing channels, budget — plus a
 * headline total. The renderer turns the structured fields into a clean quote
 * markdown deterministically.
 */
@Entity({ name: 'quotes' })
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'customer_id' })
  customerId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: QuoteStatus;

  /* -- Section 1: customer journey ----------------------------------------- */
  @Column({ type: 'text', name: 'journey', default: '' })
  journey!: string;

  /* -- Section 2: marketing channels --------------------------------------- */
  @Column({ type: 'jsonb', name: 'channels', default: () => "'[]'::jsonb" })
  channels!: QuoteChannel[];

  /* -- Section 3: budget ---------------------------------------------------- */
  @Column({ type: 'text', name: 'budget_summary', default: '' })
  budgetSummary!: string;

  /** Headline total (free text — allows "₪12,000 + מע״מ"). */
  @Column({ type: 'varchar', length: 64, name: 'total', nullable: true })
  total!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

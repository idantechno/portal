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

/** One marketing channel line inside the quote (legacy marketing structure). */
export interface QuoteChannel {
  /** Channel name, e.g. "אינסטגרם ממומן". */
  name: string;
  /** What's done on it. */
  description: string;
  /** Budget for this channel (free text — "₪2,000/חודש"). */
  budget: string;
}

/** One priced line inside the quote — the business-agnostic structure. */
export interface QuoteLineItem {
  /** Line name, e.g. "עיצוב UI/UX" / "פיתוח פרונט". */
  name: string;
  /** What this line covers. */
  description: string;
  /** Price for this line (free text, ALWAYS operator-filled — "₪2,500"). The
   *  AI drafter never sets this; it leaves the pricing to the operator. */
  amount: string;
}

/**
 * A price quote for a customer — the "הצעת מחיר" prerequisite of a campaign.
 * Authored at the quote agent and linked to the customer, where it surfaces
 * among the customer's reports.
 *
 * The quote adapts to the BUSINESS's character, not to marketing: its primary
 * shape is a flexible `intro` (scope) + `lineItems` (item · description ·
 * price) + `total` + `notes` (terms), which fits a web build, a service
 * package, a clinic, or a marketing plan alike. The AI drafter tailors the
 * line items to the business's field/offerings and leaves prices blank.
 *
 * The legacy marketing sections (`journey` / `channels` / `budgetSummary`) are
 * kept so older marketing quotes still render; the renderer prefers the
 * flexible structure and falls back to them only when it's empty. The renderer
 * assembles the markdown deterministically — no model call at render time.
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

  /* -- Flexible structure (business-tailored; supersedes the sections below) */
  /** Scope / what's included — free text intro. */
  @Column({ type: 'text', name: 'intro', default: '' })
  intro!: string;

  /** Priced lines: item · description · price. The primary quote body. */
  @Column({ type: 'jsonb', name: 'line_items', default: () => "'[]'::jsonb" })
  lineItems!: QuoteLineItem[];

  /* -- Legacy marketing sections (kept for back-compat; renderer falls back) */
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

  /**
   * Unguessable token that authenticates the public PDF link (the wa.me share).
   * Null until the operator shares the quote; set once and reused thereafter.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, name: 'public_token', nullable: true })
  publicToken!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContactStatus } from '../common/enums/contact-status.enum';

/**
 * How this person record came to be. The original three (`manual` | `lead` |
 * `contact`) mark hand-created / lead-promoted / contact-promoted rows; the
 * unification adds finer provenance for people who land straight in the
 * unified list from an intake flow (`agent` capture, public `questionnaire`,
 * website `intake`). Stored as a plain varchar — widening this union is
 * additive and never rewrites an existing value. */
export type CustomerSource =
  | 'manual'
  | 'lead'
  | 'contact'
  | 'agent'
  | 'questionnaire'
  | 'intake';

/**
 * The central customer/account record — a business (or person) the operator
 * actively works for. This is the single source of truth for "who our customers
 * are": the sidebar "לקוחות" list and every agent (marketing today, others
 * later) read the SAME rows and hang their own documents on them via a
 * `customer_id` foreign key (see `briefs`, `strategies`).
 *
 * A customer is created either manually (`source = 'manual'`) or by promoting a
 * lead (`source = 'lead'`, `leadId` set). It optionally links to a conversation
 * contact (`customerContactId`) so the agent that chats with them and the CRM
 * account are the same entity — without forcing every customer to have ever
 * messaged (a manually-added one has no contact).
 */
@Entity({ name: 'customers' })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** Contact / owner name. */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** The customer's own business name, when it differs from the contact name. */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'business_name',
    nullable: true,
  })
  businessName!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  /** Free-text operator notes about this customer. */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source!: CustomerSource;

  /**
   * Lifecycle stage of this person — the canonical field for the emerging
   * Contact/Lead/Customer unification. Reuses {@link ContactStatus} values
   * (`lead` | `customer`). Defaults to `customer` at the DB level because every
   * existing `customers` row already represents a paying customer; the column
   * exists so future intake/lead flows can land here as `lead` and be promoted
   * in place. Phase 1 only ADDS this field — no write path sets it yet.
   */
  @Column({ type: 'varchar', length: 16, default: ContactStatus.Customer })
  stage!: ContactStatus;

  /** What this person is interested in — free text captured at intake time. */
  @Column({ type: 'text', nullable: true })
  interest!: string | null;

  /** Finer-grained provenance than `source` (e.g. which form/campaign/page). */
  @Column({
    type: 'varchar',
    length: 160,
    name: 'source_detail',
    nullable: true,
  })
  sourceDetail!: string | null;

  /** Arbitrary structured payload captured at intake (form answers, UTM, …). */
  @Column({ type: 'jsonb', name: 'captured_data', nullable: true })
  capturedData!: Record<string, unknown> | null;

  /**
   * Digits-only, last-9 normalization of `phone` (mirrors `normalizePhoneKey`
   * in the service) — an indexed key so a future unified lookup can match a
   * person by phone without scanning every row. Plain index, NOT unique.
   */
  @Index()
  @Column({
    type: 'varchar',
    length: 16,
    name: 'normalized_phone',
    nullable: true,
  })
  normalizedPhone!: string | null;

  /** The lead this customer was promoted from, if any. Keeps the questionnaire
   *  answers reachable (via the lead) so a brief can still be generated. */
  @Index()
  @Column({ type: 'uuid', name: 'lead_id', nullable: true })
  leadId!: string | null;

  /** Optional link to the conversation contact (WhatsApp/web thread). */
  @Index()
  @Column({ type: 'uuid', name: 'customer_contact_id', nullable: true })
  customerContactId!: string | null;

  /** When they became a customer — drives the "תאריך רישום כלקוח" sort. */
  @Column({
    type: 'timestamptz',
    name: 'became_customer_at',
    default: () => 'now()',
  })
  becameCustomerAt!: Date;

  /**
   * Brand assets are made OUTSIDE the system (each owner builds their own).
   * These are manual confirmations that they exist — a campaign's stage-C
   * prerequisites — with an optional link to where they live.
   */
  @Column({ type: 'boolean', name: 'brand_page_ready', default: false })
  brandPageReady!: boolean;

  @Column({
    type: 'varchar',
    length: 512,
    name: 'brand_page_url',
    nullable: true,
  })
  brandPageUrl!: string | null;

  @Column({ type: 'boolean', name: 'logo_ready', default: false })
  logoReady!: boolean;

  @Column({ type: 'varchar', length: 512, name: 'logo_url', nullable: true })
  logoUrl!: string | null;

  /** Next planned activity — drives the "פעילות קרובה הבאה" sort and the לו"ז tab. */
  @Column({ type: 'timestamptz', name: 'next_activity_at', nullable: true })
  nextActivityAt!: Date | null;

  /** What that next activity is (short label shown in the schedule). */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'next_activity_note',
    nullable: true,
  })
  nextActivityNote!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

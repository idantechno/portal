import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** How this customer record came to be: created by hand, promoted from a
 *  marketing lead, or promoted from a conversation contact. */
export type CustomerSource = 'manual' | 'lead' | 'contact';

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

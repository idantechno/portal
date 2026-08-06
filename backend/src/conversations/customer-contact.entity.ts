import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../common/enums/channel.enum';
import { ContactStatus } from '../common/enums/contact-status.enum';
import { ContactAgentMode } from '../common/enums/contact-agent-mode.enum';

/**
 * A unique end-user per (business, channel, external_id) — e.g. one WhatsApp
 * phone number, one Instagram IGSID, one web widget session.
 */
@Entity({ name: 'customer_contacts' })
@Index('uq_contact_external', ['businessId', 'channel', 'externalId'], {
  unique: true,
})
export class CustomerContact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'enum', enum: Channel })
  channel!: Channel;

  /** Channel-native ID: phone number (whatsapp), IGSID (instagram), session token (web). */
  @Column({ type: 'varchar', length: 255, name: 'external_id' })
  externalId!: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'display_name',
    nullable: true,
  })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  /**
   * Relationship stage. Drives how the agent addresses this person — a paying
   * customer is greeted with familiarity and priority, a lead is nurtured.
   * Defaults to `lead`; an operator (or the agent, once it captures a sale)
   * promotes them to `customer`.
   */
  @Column({
    type: 'enum',
    enum: ContactStatus,
    default: ContactStatus.Lead,
  })
  status!: ContactStatus;

  /**
   * Reverse link to the canonical `customers` "person" this channel handle
   * belongs to, once unified. Nullable and plain-indexed — deliberately NOT a
   * FK-with-cascade so it can never affect contact/customer deletes. Phase 1
   * only ADDS the column; no write path populates it yet (the backfill fills it
   * where a customer already points here via `customer_contact_id`).
   */
  @Index()
  @Column({ type: 'uuid', name: 'customer_id', nullable: true })
  customerId!: string | null;

  /**
   * How the agent treats THIS contact (active / off / delayed). Lets the owner
   * silence the agent for a specific person, or keep a private window to answer
   * first before the agent steps in. Stored as a plain varchar so widening the
   * set never rewrites existing rows. See {@link ContactAgentMode}.
   */
  @Column({
    type: 'varchar',
    length: 16,
    name: 'agent_mode',
    default: ContactAgentMode.Active,
  })
  agentMode!: ContactAgentMode;

  /**
   * For `delayed` mode: how many minutes to give the owner to reply before the
   * agent steps in. Null unless the contact is in delayed mode. Constrained to
   * the UI's choices at the DTO.
   */
  @Column({
    type: 'int',
    name: 'agent_delay_minutes',
    nullable: true,
  })
  agentDelayMinutes!: number | null;

  /** Free-text operator notes about this person (allergies, preferences, …). */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

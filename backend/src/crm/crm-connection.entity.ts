import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * How a business's captured data leaves Portal for the tool they already use.
 * MVP is `webhook` (a generic outbound HTTP POST — connects to almost any CRM
 * directly or through Zapier/Make). New destinations (a native CRM adapter,
 * Google Sheets) plug in as more `type` values without schema changes.
 */
export type CrmDestinationType = 'webhook';

/**
 * One external destination per business — where new leads and appointments are
 * pushed so the owner can keep working in their own CRM/calendar. The connection
 * secret (webhook URL + signing secret) lives encrypted in `config_encrypted`,
 * same crypto as the WhatsApp tokens.
 */
@Entity({ name: 'crm_connections' })
export class CrmConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // One destination per business (MVP). Unique so upserts are by business.
  @Index('uq_crm_connection_business', { unique: true })
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 32, default: 'webhook' })
  type!: CrmDestinationType;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /** Encrypted JSON of the destination config (e.g. { url, secret }). */
  @Column({ type: 'text', name: 'config_encrypted' })
  configEncrypted!: string;

  /** Whether captured leads are pushed to the destination. */
  @Column({ type: 'boolean', name: 'push_leads', default: true })
  pushLeads!: boolean;

  /** Whether booked appointments are pushed to the destination. */
  @Column({ type: 'boolean', name: 'push_appointments', default: true })
  pushAppointments!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

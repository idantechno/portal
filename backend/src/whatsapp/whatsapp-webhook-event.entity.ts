import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Append-only audit log for every inbound Meta webhook hit. Kept for the
 * first month or two while we shake out parsing/signature edge cases.
 */
@Entity({ name: 'whatsapp_webhook_events' })
export class WhatsappWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id', nullable: true })
  businessId!: string | null;

  @Column({ type: 'jsonb', name: 'raw_payload' })
  rawPayload!: Record<string, unknown>;

  @Column({ type: 'boolean', name: 'signature_ok' })
  signatureOk!: boolean;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

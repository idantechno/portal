import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MessageRole } from '../common/enums/message-role.enum';

/**
 * Channel-agnostic message record. `content` is the human-readable text;
 * `contentJson` carries channel-specific extras (attachments, tool calls,
 * delivery receipts, raw inbound payload for debugging).
 */
@Entity({ name: 'messages' })
// Partial unique index: an inbound provider message (wamid) can only land once
// per business. Turns the check-then-insert dedupe into a hard DB guarantee, so
// concurrent Meta retries can't create duplicate customer messages + agent runs.
@Index('uq_message_external', ['businessId', 'externalMessageId'], {
  unique: true,
  where: '"external_message_id" IS NOT NULL',
})
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'enum', enum: MessageRole })
  role!: MessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', name: 'content_json', nullable: true })
  contentJson!: Record<string, unknown> | null;

  /** User id of the human agent who sent this message, when role = 'agent'. */
  @Column({ type: 'uuid', name: 'agent_user_id', nullable: true })
  agentUserId!: string | null;

  /** Provider message id (e.g. WhatsApp wamid) — for de-duplication of inbound. */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'external_message_id',
    nullable: true,
  })
  externalMessageId!: string | null;

  /**
   * Delivery state for outbound (bot/agent) messages:
   * 'sent' once the channel adapter accepted it, 'failed' if dispatch threw.
   * Null for inbound customer messages. Lets the inbox surface undelivered
   * replies instead of silently pretending they were sent.
   */
  @Column({
    type: 'varchar',
    length: 16,
    name: 'delivery_status',
    nullable: true,
  })
  deliveryStatus!: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

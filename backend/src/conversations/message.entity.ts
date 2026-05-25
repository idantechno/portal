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

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

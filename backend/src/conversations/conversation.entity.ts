import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../common/enums/channel.enum';
import { ConversationStatus } from '../common/enums/conversation-status.enum';

@Entity({ name: 'conversations' })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'enum', enum: Channel })
  channel!: Channel;

  /** Channel-native thread id; for WhatsApp/Instagram = the customer phone/IGSID. */
  @Column({ type: 'varchar', length: 255, name: 'external_thread_id' })
  externalThreadId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'customer_contact_id' })
  customerContactId!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.Bot,
  })
  status!: ConversationStatus;

  @Column({
    type: 'uuid',
    name: 'assigned_agent_user_id',
    nullable: true,
  })
  assignedAgentUserId!: string | null;

  @Index()
  @Column({ type: 'timestamptz', name: 'last_message_at', nullable: true })
  lastMessageAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AgentChatRole = 'user' | 'assistant';

/**
 * One turn in an owner↔agent workspace chat (Main, Designer, Documents, Ideas,
 * Reminders, and the generic workspace agents). These chats used to live only in
 * the browser's component state and vanished on refresh; persisting them lets a
 * business reopen an agent and see the last conversation.
 *
 * Scoped by (businessId, agentKey). Retention is 30 days — reads filter to that
 * window and writes opportunistically purge older rows, so no scheduler is
 * needed. This is a UI convenience log, NOT the customer conversation store
 * (that's `conversations`/`messages`).
 */
@Entity({ name: 'agent_chat_messages' })
// One composite index serves both the recent-history read and the purge.
@Index('IDX_agent_chat_thread', ['businessId', 'agentKey', 'createdAt'])
export class AgentChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** Which workspace agent this turn belongs to (e.g. 'main', 'designer'). */
  @Column({ type: 'varchar', length: 64, name: 'agent_key' })
  agentKey!: string;

  @Column({ type: 'varchar', length: 16 })
  role!: AgentChatRole;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

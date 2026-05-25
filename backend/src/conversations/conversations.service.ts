import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { Channel } from '../common/enums/channel.enum';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
import { MessageRole } from '../common/enums/message-role.enum';
import {
  AGENT_RUNS_QUEUE,
  AgentRunJobData,
} from '../agent-worker/agent-worker.constants';
import { InboxEventsService } from '../inbox/inbox-events.service';

export interface FindOrCreateConversationInput {
  businessId: string;
  channel: Channel;
  externalThreadId: string;
  customerContactId: string;
}

export interface AppendMessageInput {
  businessId: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  contentJson?: Record<string, unknown> | null;
  agentUserId?: string | null;
  externalMessageId?: string | null;
}

@Injectable()
export class ConversationsService {
  private readonly log = new Logger(ConversationsService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @InjectQueue(AGENT_RUNS_QUEUE)
    private readonly agentRuns: Queue<AgentRunJobData>,
    private readonly inbox: InboxEventsService,
  ) {}

  async findOrCreate(
    input: FindOrCreateConversationInput,
  ): Promise<Conversation> {
    const existing = await this.conversations.findOne({
      where: {
        businessId: input.businessId,
        channel: input.channel,
        externalThreadId: input.externalThreadId,
      },
    });
    if (existing) return existing;
    const created = await this.conversations.save(
      this.conversations.create({
        businessId: input.businessId,
        channel: input.channel,
        externalThreadId: input.externalThreadId,
        customerContactId: input.customerContactId,
        status: ConversationStatus.Bot,
      }),
    );
    this.inbox.conversationCreated(created);
    return created;
  }

  async findByIdScoped(
    businessId: string,
    conversationId: string,
  ): Promise<Conversation> {
    const conv = await this.conversations.findOne({
      where: { id: conversationId, businessId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  list(
    businessId: string,
    options: { status?: ConversationStatus; limit?: number; offset?: number },
  ): Promise<Conversation[]> {
    const where = options.status
      ? { businessId, status: options.status }
      : { businessId };
    return this.conversations.find({
      where,
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
  }

  async appendMessage(input: AppendMessageInput): Promise<Message> {
    const conv = await this.findByIdScoped(
      input.businessId,
      input.conversationId,
    );
    const msg = await this.messages.save(
      this.messages.create({
        conversationId: conv.id,
        businessId: conv.businessId,
        role: input.role,
        content: input.content,
        contentJson: input.contentJson ?? null,
        agentUserId: input.agentUserId ?? null,
        externalMessageId: input.externalMessageId ?? null,
      }),
    );
    conv.lastMessageAt = msg.createdAt;
    await this.conversations.save(conv);

    this.inbox.messageCreated(msg);
    this.inbox.conversationUpdated(conv);

    if (input.role === MessageRole.Customer) {
      await this.enqueueAgentRun(conv, msg);
    }

    return msg;
  }

  private async enqueueAgentRun(
    conversation: Conversation,
    message: Message,
  ): Promise<void> {
    if (conversation.status !== ConversationStatus.Bot) return;
    try {
      await this.agentRuns.add(
        'run',
        {
          businessId: conversation.businessId,
          conversationId: conversation.id,
          latestMessageId: message.id,
        },
        { removeOnComplete: 100, removeOnFail: 200 },
      );
    } catch (err) {
      this.log.error(
        `Failed to enqueue agent run for conversation ${conversation.id}: ${(err as Error).message}`,
      );
    }
  }

  listMessages(
    businessId: string,
    conversationId: string,
    options: { limit?: number; before?: Date } = {},
  ): Promise<Message[]> {
    return this.messages.find({
      where: { businessId, conversationId },
      order: { createdAt: 'ASC' },
      take: options.limit ?? 200,
    });
  }

  /**
   * For channel-level dedup (e.g. Meta retries the same wamid). Scoped by
   * business so a wamid collision across tenants — unlikely but possible —
   * never crosses the line.
   */
  findMessageByExternalId(
    businessId: string,
    externalMessageId: string,
  ): Promise<Message | null> {
    return this.messages.findOne({
      where: { businessId, externalMessageId },
    });
  }

  async setStatus(
    businessId: string,
    conversationId: string,
    status: ConversationStatus,
    assignedAgentUserId?: string | null,
  ): Promise<Conversation> {
    const conv = await this.findByIdScoped(businessId, conversationId);
    conv.status = status;
    if (
      status === ConversationStatus.Human &&
      assignedAgentUserId !== undefined
    ) {
      conv.assignedAgentUserId = assignedAgentUserId;
    }
    if (status === ConversationStatus.Bot) {
      conv.assignedAgentUserId = null;
    }
    const saved = await this.conversations.save(conv);
    this.inbox.conversationUpdated(saved);
    return saved;
  }

  /**
   * Marks a conversation as taken over by a human agent. Idempotent.
   */
  async takeover(
    businessId: string,
    conversationId: string,
    agentUserId: string,
  ): Promise<Conversation> {
    const conv = await this.findByIdScoped(businessId, conversationId);
    if (conv.status === ConversationStatus.Closed) {
      throw new BadRequestException('Conversation is closed');
    }
    conv.status = ConversationStatus.Human;
    conv.assignedAgentUserId = agentUserId;
    const saved = await this.conversations.save(conv);
    this.inbox.conversationUpdated(saved);
    return saved;
  }

  async returnToBot(
    businessId: string,
    conversationId: string,
  ): Promise<Conversation> {
    return this.setStatus(businessId, conversationId, ConversationStatus.Bot);
  }
}

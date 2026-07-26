import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { Business } from '../businesses/business.entity';
import { Channel } from '../common/enums/channel.enum';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
import { MessageRole } from '../common/enums/message-role.enum';
import {
  DEFAULT_WHATSAPP_AGENT,
  WhatsappAgentConfig,
  whatsappAgentActiveNow,
} from '../common/whatsapp-agent-schedule';
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
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
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
    const previousLastMessageAt = conv.lastMessageAt;
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
      await this.maybeAutoReturnToAgent(conv, previousLastMessageAt);
      await this.enqueueAgentRun(conv, msg);
    }

    return msg;
  }

  private async enqueueAgentRun(
    conversation: Conversation,
    message: Message,
  ): Promise<void> {
    if (!(await this.shouldAgentReply(conversation))) return;
    try {
      await this.agentRuns.add(
        'run',
        {
          businessId: conversation.businessId,
          conversationId: conversation.id,
          latestMessageId: message.id,
        },
        {
          // Idempotent enqueue: one run per inbound message. If the same
          // customer message is appended twice (Meta retry that slips past the
          // wamid dedupe), BullMQ collapses both to a single job.
          // Hyphen, not colon — BullMQ forbids ':' in custom job ids.
          jobId: `run-${message.id}`,
          // Retry transient failures (LLM 429/5xx, network) with exponential
          // backoff: ~5s, 10s, 20s. A persistently failing run lands in failed.
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
    } catch (err) {
      this.log.error(
        `Failed to enqueue agent run for conversation ${conversation.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Whether the agent may auto-answer this conversation right now.
   *  - status must be `bot` (a human takeover or closed thread is left alone);
   *  - the website widget always uses the agent;
   *  - WhatsApp follows the business's agent schedule (mode/hours).
   */
  private async shouldAgentReply(conversation: Conversation): Promise<boolean> {
    if (conversation.status !== ConversationStatus.Bot) return false;
    if (conversation.channel === Channel.Web) return true;
    const config = await this.getWhatsappAgentConfig(conversation.businessId);
    return whatsappAgentActiveNow(config);
  }

  async getWhatsappAgentConfig(
    businessId: string,
  ): Promise<WhatsappAgentConfig> {
    const business = await this.businesses.findOne({
      where: { id: businessId },
    });
    return business?.whatsappAgent ?? DEFAULT_WHATSAPP_AGENT;
  }

  /**
   * If a manually-handled WhatsApp thread has been idle beyond the configured
   * window, hand it back to the agent so an after-hours follow-up still gets a
   * reply (subject to the schedule). Mutates & persists `conversation` in place.
   */
  private async maybeAutoReturnToAgent(
    conversation: Conversation,
    previousLastMessageAt: Date | null,
  ): Promise<void> {
    if (conversation.channel !== Channel.WhatsApp) return;
    if (conversation.status !== ConversationStatus.Human) return;
    if (!previousLastMessageAt) return;
    const config = await this.getWhatsappAgentConfig(conversation.businessId);
    const hours = config.autoReturnHours ?? 0;
    if (hours <= 0) return;
    const idleMs = Date.now() - previousLastMessageAt.getTime();
    if (idleMs < hours * 3_600_000) return;
    conversation.status = ConversationStatus.Bot;
    conversation.assignedAgentUserId = null;
    await this.conversations.save(conversation);
    this.inbox.conversationUpdated(conversation);
    this.log.log(
      `Auto-returned conversation ${conversation.id} to the agent after ` +
        `${Math.round(idleMs / 3_600_000)}h idle`,
    );
  }

  /**
   * Returns the most recent messages in chronological (oldest→newest) order.
   * We query newest-first so a `take` window keeps the *latest* N messages —
   * including the customer's newest one — then reverse for prompt/display use.
   * Fetching oldest-first would freeze the agent's context on stale history.
   */
  async listMessages(
    businessId: string,
    conversationId: string,
    options: { limit?: number; before?: Date } = {},
  ): Promise<Message[]> {
    const where: Record<string, unknown> = { businessId, conversationId };
    if (options.before) {
      where.createdAt = LessThan(options.before);
    }
    const rows = await this.messages.find({
      where,
      order: { createdAt: 'DESC' },
      take: options.limit ?? 200,
    });
    return rows.reverse();
  }

  /**
   * Records the outcome of an outbound dispatch: persists the provider message
   * id (wamid) for delivery-receipt correlation and marks the message
   * 'sent' or 'failed'. Emits an inbox update so a failed reply is visible.
   */
  async markDelivery(
    message: Message,
    status: 'sent' | 'failed',
    externalMessageId?: string | null,
  ): Promise<void> {
    message.deliveryStatus = status;
    if (externalMessageId) {
      message.externalMessageId = externalMessageId;
    }
    await this.messages.save(message);
    this.inbox.messageCreated(message);
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

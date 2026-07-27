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
import { ContactStatus } from '../common/enums/contact-status.enum';
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
  /**
   * The contact's status, which decides threading. Customers keep ONE
   * continuous thread (personal, like a normal WhatsApp contact); leads get a
   * fresh conversation per inquiry episode. Defaults to lead-style if omitted.
   */
  contactStatus?: ContactStatus;
  /**
   * 'write' = a new inbound customer message is arriving, so a lead whose last
   * episode is closed or has gone quiet rolls into a NEW conversation. 'read'
   * (default) = merely resolving the current thread (listing history, owner
   * echoes) — never starts a new episode, so the inbox isn't cluttered with
   * empty conversations on every poll.
   */
  purpose?: 'read' | 'write';
}

/**
 * How long a lead's conversation may stay quiet before the next inbound message
 * is treated as a new inquiry episode (a separate conversation). Tunable — a
 * day-scale gap keeps an active back-and-forth together while splitting a
 * genuine "came back a week later" return into its own thread.
 */
const LEAD_EPISODE_GAP_HOURS = 24;

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

  /**
   * Resolve the conversation an incoming/outgoing message belongs to.
   *
   * Threading policy (see FindOrCreateConversationInput):
   * - Customer → one continuous thread: always reuse the contact's latest
   *   conversation (more personal, like a normal WhatsApp contact).
   * - Lead → episodic: reuse the latest conversation while it's still active
   *   (open and not gone quiet); once it's closed or past LEAD_EPISODE_GAP_HOURS,
   *   a NEW inbound message starts a fresh conversation, so each inquiry is its
   *   own inbox item instead of one endless thread.
   *
   * The lookup is keyed on the contact (not the raw thread id) so a second
   * episode can exist alongside the first without colliding on the unique
   * (business, channel, externalThreadId) index — the new episode gets a
   * suffixed thread id.
   */
  async findOrCreate(
    input: FindOrCreateConversationInput,
  ): Promise<Conversation> {
    const latest = await this.conversations.findOne({
      where: {
        businessId: input.businessId,
        channel: input.channel,
        customerContactId: input.customerContactId,
      },
      order: { createdAt: 'DESC' },
    });

    // Customers: single continuous thread on their most recent conversation.
    if (input.contactStatus === ContactStatus.Customer) {
      return latest ?? this.createConversation(input, input.externalThreadId);
    }

    // Leads: first ever contact, or an episode still active → reuse/create base.
    if (!latest) {
      return this.createConversation(input, input.externalThreadId);
    }
    if (input.purpose !== 'write' || this.isEpisodeActive(latest)) {
      return latest;
    }

    // A new inbound after the episode closed or went quiet → new episode. The
    // base thread id is taken by a prior episode, so derive a unique one.
    const priorCount = await this.conversations.count({
      where: {
        businessId: input.businessId,
        channel: input.channel,
        customerContactId: input.customerContactId,
      },
    });
    return this.createConversation(
      input,
      `${input.externalThreadId}#e${priorCount + 1}`,
    );
  }

  /** True while a conversation is open and hasn't gone quiet past the gap. */
  private isEpisodeActive(conv: Conversation): boolean {
    if (conv.status === ConversationStatus.Closed) return false;
    const last = conv.lastMessageAt ?? conv.createdAt;
    const idleMs = Date.now() - new Date(last).getTime();
    return idleMs < LEAD_EPISODE_GAP_HOURS * 3_600_000;
  }

  private async createConversation(
    input: FindOrCreateConversationInput,
    externalThreadId: string,
  ): Promise<Conversation> {
    const created = await this.conversations.save(
      this.conversations.create({
        businessId: input.businessId,
        channel: input.channel,
        externalThreadId,
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

  /** All conversations belonging to a contact (usually one per channel). */
  listByContact(
    businessId: string,
    contactId: string,
  ): Promise<Conversation[]> {
    return this.conversations.find({
      where: { businessId, customerContactId: contactId },
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
    });
  }

  /** Lifetime engagement stats for a contact, for the contact card header. */
  async contactStats(
    businessId: string,
    contactId: string,
  ): Promise<{
    messageCount: number;
    firstMessageAt: Date | null;
    lastMessageAt: Date | null;
  }> {
    const row = await this.messages
      .createQueryBuilder('m')
      .select('COUNT(*)', 'count')
      .addSelect('MIN(m.created_at)', 'first')
      .addSelect('MAX(m.created_at)', 'last')
      .where('m.business_id = :businessId', { businessId })
      .andWhere(
        'm.conversation_id IN ' +
          '(SELECT id FROM conversations WHERE business_id = :businessId ' +
          'AND customer_contact_id = :contactId)',
        { contactId },
      )
      .getRawOne<{ count: string; first: Date | null; last: Date | null }>();
    return {
      messageCount: Number(row?.count ?? 0),
      firstMessageAt: row?.first ?? null,
      lastMessageAt: row?.last ?? null,
    };
  }
}

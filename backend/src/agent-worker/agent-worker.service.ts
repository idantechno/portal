import { Injectable, Logger } from '@nestjs/common';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { ConversationsService } from '../conversations/conversations.service';
import { CustomerContactsService } from '../conversations/customer-contacts.service';
import { BusinessesService } from '../businesses/businesses.service';
import { FilesystemService } from '../context-files/filesystem.service';
import { BusinessContextService } from '../context-files/business-context.service';
import { ChannelRegistry } from '../channels/channel-registry.service';
import { LeadsService } from '../leads/leads.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { WaitlistService } from '../appointments/waitlist.service';
import { AgentRunner } from '../agents/agent-runner.service';
import { AgentsService } from '../agents/agents.service';
import { BillingService } from '../billing/billing.service';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
import { MessageRole } from '../common/enums/message-role.enum';
import { AgentRunJobData } from './agent-worker.constants';
import {
  buildAppointmentsBlock,
  buildContactBlock,
  buildSystemPrompt,
  buildUserPrompt,
} from './prompt';
import {
  cancelAppointmentTool,
  captureLeadTool,
  escalateToHumanTool,
  joinWaitlistTool,
  rescheduleAppointmentTool,
  scheduleAppointmentTool,
} from './tools';

const MCP_SERVER_NAME = 'portal';
const HISTORY_LIMIT = 50;

@Injectable()
export class AgentWorkerService {
  private readonly log = new Logger(AgentWorkerService.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly contacts: CustomerContactsService,
    private readonly businesses: BusinessesService,
    private readonly leads: LeadsService,
    private readonly appointments: AppointmentsService,
    private readonly waitlist: WaitlistService,
    private readonly filesystem: FilesystemService,
    private readonly businessContext: BusinessContextService,
    private readonly channels: ChannelRegistry,
    private readonly runner: AgentRunner,
    private readonly agents: AgentsService,
    private readonly billing: BillingService,
  ) {}

  async runAgent(data: AgentRunJobData): Promise<void> {
    const conversation = await this.conversations.findByIdScoped(
      data.businessId,
      data.conversationId,
    );
    if (conversation.status !== ConversationStatus.Bot) {
      this.log.log(
        `Skipping agent run for conversation ${data.conversationId}: status=${conversation.status}`,
      );
      return;
    }

    const business = await this.businesses.findById(data.businessId);
    if (!business) {
      throw new Error(`Business ${data.businessId} not found`);
    }

    // The chat agent is gated per business — if this tenant isn't entitled,
    // don't auto-reply (the conversation still records the inbound message).
    if (!(await this.agents.hasAccess(business.id, 'chat'))) {
      this.log.log(
        `Skipping agent run for business ${business.id}: chat agent not enabled`,
      );
      return;
    }

    await this.filesystem.ensureBusinessRoot(business.id);
    const cwd = this.filesystem.businessRoot(business.id);

    const history = await this.conversations.listMessages(
      business.id,
      conversation.id,
      { limit: HISTORY_LIMIT },
    );

    const toolCtx = {
      businessId: business.id,
      conversationId: conversation.id,
      customerContactId: conversation.customerContactId,
      channel: conversation.channel,
      leads: this.leads,
      conversations: this.conversations,
      appointments: this.appointments,
      waitlist: this.waitlist,
    };

    // Appointment/waitlist tools are a top-tier capability. Only businesses
    // whose plan includes `agent_scheduling` get them wired into the agent — a
    // lower-tier chat agent literally never receives a booking tool, so it
    // cannot schedule, cancel or move appointments no matter what a customer
    // asks. This is the enforced boundary behind the pricing tiers.
    const canSchedule = await this.billing.hasCapability(
      business.id,
      'agent_scheduling',
    );

    const mcpServer = createSdkMcpServer({
      name: MCP_SERVER_NAME,
      version: '0.1.0',
      tools: [
        captureLeadTool(toolCtx),
        escalateToHumanTool(toolCtx),
        ...(canSchedule
          ? [
              scheduleAppointmentTool(toolCtx),
              joinWaitlistTool(toolCtx),
              cancelAppointmentTool(toolCtx),
              rescheduleAppointmentTool(toolCtx),
            ]
          : []),
      ],
    });

    const contextBlock = await this.businessContext.promptBlock(business.id);

    // Personalisation: who is on the other end (paying customer vs lead) and
    // whether we've spoken before, so the agent addresses them by name and
    // history instead of treating every message as a cold first contact.
    const contact = conversation.customerContactId
      ? await this.contacts.findByIdScoped(
          business.id,
          conversation.customerContactId,
        )
      : null;
    const stats = await this.conversations.contactStats(
      business.id,
      conversation.customerContactId,
    );
    const contactBlock = buildContactBlock({
      contact,
      messageCount: stats.messageCount,
      firstMessageAt: stats.firstMessageAt,
    });

    // Appointment awareness: the customer's own upcoming appointments (so the
    // agent can cancel/move the right one) and any freed-slot offer awaiting
    // their answer (so a bare "yes" books it). Both scoped to this contact.
    const [upcoming, pendingOffer] = await Promise.all([
      this.appointments.listUpcomingForContact(
        business.id,
        conversation.customerContactId,
      ),
      this.waitlist.findOpenOfferForContact(
        business.id,
        conversation.customerContactId,
      ),
    ]);
    const appointmentsBlock = buildAppointmentsBlock({
      upcoming,
      pendingOffer:
        pendingOffer && pendingOffer.offeredSlotStart
          ? {
              service: pendingOffer.service,
              offeredSlotStart: pendingOffer.offeredSlotStart,
              moveAppointmentId: pendingOffer.moveAppointmentId,
            }
          : null,
    });

    const { finalText } = await this.runner.run({
      systemPrompt: buildSystemPrompt(
        business,
        contextBlock,
        contactBlock,
        appointmentsBlock,
      ),
      prompt: buildUserPrompt(history),
      cwd,
      mcpServers: { [MCP_SERVER_NAME]: mcpServer },
      allowedMcpTools: [
        `mcp__${MCP_SERVER_NAME}__capture_lead`,
        `mcp__${MCP_SERVER_NAME}__escalate_to_human`,
        ...(canSchedule
          ? [
              `mcp__${MCP_SERVER_NAME}__schedule_appointment`,
              `mcp__${MCP_SERVER_NAME}__join_waitlist`,
              `mcp__${MCP_SERVER_NAME}__cancel_appointment`,
              `mcp__${MCP_SERVER_NAME}__reschedule_appointment`,
            ]
          : []),
      ],
      runLabel: `conversation=${conversation.id}`,
    });

    if (!finalText.trim()) {
      this.log.warn(
        `Agent produced no text for conversation ${conversation.id}; skipping reply.`,
      );
      return;
    }

    const refreshed = await this.conversations.findByIdScoped(
      business.id,
      conversation.id,
    );

    // A human may have taken the conversation over while the LLM was running.
    // Don't talk over the human agent — drop the generated reply.
    if (refreshed.status !== ConversationStatus.Bot) {
      this.log.log(
        `Conversation ${conversation.id} left bot status mid-run (status=${refreshed.status}); dropping reply.`,
      );
      return;
    }

    const reply = await this.conversations.appendMessage({
      businessId: business.id,
      conversationId: conversation.id,
      role: MessageRole.Bot,
      content: finalText,
    });

    try {
      const result = await this.channels.dispatch(refreshed, reply);
      await this.conversations.markDelivery(
        reply,
        'sent',
        result.externalMessageId,
      );
    } catch (err) {
      // The reply is stored but never reached the customer. Mark it failed so
      // the inbox surfaces it as undelivered rather than silently pretending it
      // was sent. We deliberately do NOT rethrow: a BullMQ retry would re-run
      // the LLM and append a *second* bot reply. Redispatching the existing
      // reply is a follow-up; for now a failed dispatch is a visible, logged,
      // operator-actionable state instead of silent data loss.
      await this.conversations.markDelivery(reply, 'failed');
      this.log.error(
        `Channel dispatch FAILED for ${refreshed.channel} on conversation ${conversation.id}: ${(err as Error).message}`,
      );
    }
  }
}

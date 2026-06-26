import { Injectable, Logger } from '@nestjs/common';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { ConversationsService } from '../conversations/conversations.service';
import { BusinessesService } from '../businesses/businesses.service';
import { FilesystemService } from '../context-files/filesystem.service';
import { ChannelRegistry } from '../channels/channel-registry.service';
import { LeadsService } from '../leads/leads.service';
import { AgentRunner } from '../agents/agent-runner.service';
import { AgentsService } from '../agents/agents.service';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
import { MessageRole } from '../common/enums/message-role.enum';
import { AgentRunJobData } from './agent-worker.constants';
import { buildSystemPrompt, buildUserPrompt } from './prompt';
import { captureLeadTool, escalateToHumanTool } from './tools';

const MCP_SERVER_NAME = 'portal';
const HISTORY_LIMIT = 50;

@Injectable()
export class AgentWorkerService {
  private readonly log = new Logger(AgentWorkerService.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly businesses: BusinessesService,
    private readonly leads: LeadsService,
    private readonly filesystem: FilesystemService,
    private readonly channels: ChannelRegistry,
    private readonly runner: AgentRunner,
    private readonly agents: AgentsService,
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
      leads: this.leads,
      conversations: this.conversations,
    };

    const mcpServer = createSdkMcpServer({
      name: MCP_SERVER_NAME,
      version: '0.1.0',
      tools: [captureLeadTool(toolCtx), escalateToHumanTool(toolCtx)],
    });

    const { finalText } = await this.runner.run({
      systemPrompt: buildSystemPrompt(business),
      prompt: buildUserPrompt(history),
      cwd,
      mcpServers: { [MCP_SERVER_NAME]: mcpServer },
      allowedMcpTools: [
        `mcp__${MCP_SERVER_NAME}__capture_lead`,
        `mcp__${MCP_SERVER_NAME}__escalate_to_human`,
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

    const reply = await this.conversations.appendMessage({
      businessId: business.id,
      conversationId: conversation.id,
      role: MessageRole.Bot,
      content: finalText,
    });

    try {
      const result = await this.channels.dispatch(refreshed, reply);
      if (result.externalMessageId) {
        reply.externalMessageId = result.externalMessageId;
      }
    } catch (err) {
      this.log.warn(
        `Channel dispatch skipped for ${refreshed.channel}: ${(err as Error).message}`,
      );
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { AgentRunner } from '../agents/agent-runner.service';
import { AgentsService } from '../agents/agents.service';
import { BusinessesService } from '../businesses/businesses.service';
import { FilesystemService } from '../context-files/filesystem.service';
import { BusinessContextService } from '../context-files/business-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupportRequestsService } from '../support/support-requests.service';
import {
  ChatTurn,
  buildMainSystemPrompt,
  buildMainUserPrompt,
} from './agent/prompt';
import {
  AgentSuggestion,
  ToolContext,
  openSupportRequestTool,
  suggestAgentTool,
} from './agent/tools';

const MCP_SERVER_NAME = 'main';

export interface MainChatInput {
  businessId: string;
  userId?: string | null;
  history: ChatTurn[];
}

export interface MainChatResult {
  reply: string;
  suggestions: AgentSuggestion[];
  ticketCreated: boolean;
}

@Injectable()
export class MainAgentService {
  constructor(
    private readonly runner: AgentRunner,
    private readonly businesses: BusinessesService,
    private readonly agents: AgentsService,
    private readonly support: SupportRequestsService,
    private readonly notifications: NotificationsService,
    private readonly filesystem: FilesystemService,
    private readonly businessContext: BusinessContextService,
  ) {}

  async chat(input: MainChatInput): Promise<MainChatResult> {
    const business = await this.businesses.findById(input.businessId);
    if (!business) {
      throw new NotFoundException(`Business ${input.businessId} not found`);
    }

    await this.filesystem.ensureBusinessRoot(business.id);
    const cwd = this.filesystem.businessRoot(business.id);

    // Only recommend agents this business is actually entitled to — and never
    // the concierge itself.
    const entitled = (
      await this.agents.entitledForBusiness(business.id)
    ).filter((a) => a.key !== 'main');

    const toolCtx: ToolContext = {
      businessId: business.id,
      userId: input.userId ?? null,
      entitled,
      support: this.support,
      notifications: this.notifications,
      suggestions: [],
      ticketCreated: false,
    };

    const mcpServer = createSdkMcpServer({
      name: MCP_SERVER_NAME,
      version: '0.1.0',
      tools: [suggestAgentTool(toolCtx), openSupportRequestTool(toolCtx)],
    });

    const contextBlock = await this.businessContext.promptBlock(business.id);

    const { finalText } = await this.runner.run({
      systemPrompt: buildMainSystemPrompt(business, entitled, contextBlock),
      prompt: buildMainUserPrompt(input.history),
      cwd,
      mcpServers: { [MCP_SERVER_NAME]: mcpServer },
      allowedMcpTools: [
        `mcp__${MCP_SERVER_NAME}__suggest_agent`,
        `mcp__${MCP_SERVER_NAME}__open_support_request`,
      ],
      runLabel: `main-agent business=${business.id}`,
    });

    return {
      reply: finalText,
      suggestions: toolCtx.suggestions,
      ticketCreated: toolCtx.ticketCreated,
    };
  }
}

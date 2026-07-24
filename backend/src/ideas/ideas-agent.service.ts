import { Injectable, NotFoundException } from '@nestjs/common';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { AgentRunner } from '../agents/agent-runner.service';
import { BusinessesService } from '../businesses/businesses.service';
import { FilesystemService } from '../context-files/filesystem.service';
import { BusinessContextService } from '../context-files/business-context.service';
import {
  ChatTurn,
  buildIdeasSystemPrompt,
  buildIdeasUserPrompt,
} from './agent/prompt';
import {
  ToolContext,
  developIdeaTool,
  listIdeasTool,
  saveIdeaTool,
} from './agent/tools';
import { Idea } from './idea.entity';
import { IdeasService } from './ideas.service';

const MCP_SERVER_NAME = 'ideas';

export interface IdeasChatInput {
  businessId: string;
  history: ChatTurn[];
}

export interface IdeasChatResult {
  reply: string;
  saved: Idea[];
}

@Injectable()
export class IdeasAgentService {
  constructor(
    private readonly runner: AgentRunner,
    private readonly businesses: BusinessesService,
    private readonly ideas: IdeasService,
    private readonly filesystem: FilesystemService,
    private readonly businessContext: BusinessContextService,
  ) {}

  async chat(input: IdeasChatInput): Promise<IdeasChatResult> {
    const business = await this.businesses.findById(input.businessId);
    if (!business) {
      throw new NotFoundException(`Business ${input.businessId} not found`);
    }

    await this.filesystem.ensureBusinessRoot(business.id);
    const cwd = this.filesystem.businessRoot(business.id);

    const existing = await this.ideas.list(business.id);

    const saved: Idea[] = [];
    const toolCtx: ToolContext = {
      businessId: business.id,
      ideas: this.ideas,
      saved,
    };

    const mcpServer = createSdkMcpServer({
      name: MCP_SERVER_NAME,
      version: '0.1.0',
      tools: [
        listIdeasTool(toolCtx),
        saveIdeaTool(toolCtx),
        developIdeaTool(toolCtx),
      ],
    });

    const contextBlock = await this.businessContext.promptBlock(business.id);

    const { finalText } = await this.runner.run({
      systemPrompt: buildIdeasSystemPrompt(business, existing, contextBlock),
      prompt: buildIdeasUserPrompt(input.history),
      cwd,
      mcpServers: { [MCP_SERVER_NAME]: mcpServer },
      allowedMcpTools: [
        `mcp__${MCP_SERVER_NAME}__list_ideas`,
        `mcp__${MCP_SERVER_NAME}__save_idea`,
        `mcp__${MCP_SERVER_NAME}__develop_idea`,
      ],
      runLabel: `ideas-agent business=${business.id}`,
    });

    return { reply: finalText, saved };
  }
}

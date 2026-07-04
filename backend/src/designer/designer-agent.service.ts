import { Injectable, NotFoundException } from '@nestjs/common';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { AgentRunner } from '../agents/agent-runner.service';
import { BusinessesService } from '../businesses/businesses.service';
import { FilesystemService } from '../context-files/filesystem.service';
import {
  ChatTurn,
  buildDesignerSystemPrompt,
  buildDesignerUserPrompt,
} from './agent/prompt';
import {
  ToolContext,
  generateDesignTool,
  listDesignsTool,
} from './agent/tools';
import { DesignProduct } from './design-product.entity';
import { DesignerService } from './designer.service';

const MCP_SERVER_NAME = 'designer';

export interface DesignerChatInput {
  businessId: string;
  history: ChatTurn[];
}

export interface DesignerChatResult {
  reply: string;
  created: DesignProduct[];
}

@Injectable()
export class DesignerAgentService {
  constructor(
    private readonly runner: AgentRunner,
    private readonly businesses: BusinessesService,
    private readonly designer: DesignerService,
    private readonly filesystem: FilesystemService,
  ) {}

  async chat(input: DesignerChatInput): Promise<DesignerChatResult> {
    const business = await this.businesses.findById(input.businessId);
    if (!business) {
      throw new NotFoundException(`Business ${input.businessId} not found`);
    }

    await this.filesystem.ensureBusinessRoot(business.id);
    const cwd = this.filesystem.businessRoot(business.id);

    const existing = await this.designer.list(business.id);
    const remaining = await this.designer.remainingThisMonth(business.id);

    const created: DesignProduct[] = [];
    const toolCtx: ToolContext = {
      businessId: business.id,
      designer: this.designer,
      created,
    };

    const mcpServer = createSdkMcpServer({
      name: MCP_SERVER_NAME,
      version: '0.1.0',
      tools: [listDesignsTool(toolCtx), generateDesignTool(toolCtx)],
    });

    const { finalText } = await this.runner.run({
      systemPrompt: buildDesignerSystemPrompt(business, existing, remaining),
      prompt: buildDesignerUserPrompt(input.history),
      cwd,
      mcpServers: { [MCP_SERVER_NAME]: mcpServer },
      allowedMcpTools: [
        `mcp__${MCP_SERVER_NAME}__list_designs`,
        `mcp__${MCP_SERVER_NAME}__generate_design`,
      ],
      // The model authors a full HTML document per product — give it room.
      maxTurns: 16,
      runLabel: `designer-agent business=${business.id}`,
    });

    return { reply: finalText, created };
  }
}

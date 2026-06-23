import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { AgentRunner } from '../agents/agent-runner.service';
import { BusinessesService } from '../businesses/businesses.service';
import { FilesystemService } from '../context-files/filesystem.service';
import {
  ChatTurn,
  buildDocumentsSystemPrompt,
  buildDocumentsUserPrompt,
} from './agent/prompt';
import {
  ToolContext,
  listAvailableTemplatesTool,
  prepareDocumentTool,
} from './agent/tools';
import { DocumentInstance } from './document-instance.entity';
import { DocumentsService } from './documents.service';

const MCP_SERVER_NAME = 'documents';

export interface DocumentsChatInput {
  businessId: string;
  history: ChatTurn[];
}

export interface DocumentsChatResult {
  reply: string;
  created: DocumentInstance[];
}

@Injectable()
export class DocumentsAgentService {
  constructor(
    private readonly config: ConfigService,
    private readonly runner: AgentRunner,
    private readonly businesses: BusinessesService,
    private readonly documents: DocumentsService,
    private readonly filesystem: FilesystemService,
  ) {}

  async chat(input: DocumentsChatInput): Promise<DocumentsChatResult> {
    const business = await this.businesses.findById(input.businessId);
    if (!business) {
      throw new NotFoundException(`Business ${input.businessId} not found`);
    }

    await this.filesystem.ensureBusinessRoot(business.id);
    const cwd = this.filesystem.businessRoot(business.id);

    const templates = await this.documents.listAvailableTemplates(business.id);

    const created: DocumentInstance[] = [];
    const toolCtx: ToolContext = {
      businessId: business.id,
      publicSignBaseUrl: this.config.get<string>(
        'PUBLIC_SIGN_BASE_URL',
        'http://localhost:5173',
      ),
      documents: this.documents,
      created,
    };

    const mcpServer = createSdkMcpServer({
      name: MCP_SERVER_NAME,
      version: '0.1.0',
      tools: [
        listAvailableTemplatesTool(toolCtx),
        prepareDocumentTool(toolCtx),
      ],
    });

    const { finalText } = await this.runner.run({
      systemPrompt: buildDocumentsSystemPrompt(business, templates),
      prompt: buildDocumentsUserPrompt(input.history),
      cwd,
      mcpServers: { [MCP_SERVER_NAME]: mcpServer },
      allowedMcpTools: [
        `mcp__${MCP_SERVER_NAME}__list_available_templates`,
        `mcp__${MCP_SERVER_NAME}__prepare_document`,
      ],
      runLabel: `documents-agent business=${business.id}`,
    });

    return { reply: finalText, created };
  }
}

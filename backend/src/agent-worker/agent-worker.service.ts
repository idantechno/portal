import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSdkMcpServer, query } from '@anthropic-ai/claude-agent-sdk';
import { ConversationsService } from '../conversations/conversations.service';
import { BusinessesService } from '../businesses/businesses.service';
import { FilesystemService } from '../context-files/filesystem.service';
import { ChannelRegistry } from '../channels/channel-registry.service';
import { LeadsService } from '../leads/leads.service';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
import { MessageRole } from '../common/enums/message-role.enum';
import { AgentRunJobData } from './agent-worker.constants';
import { buildSystemPrompt, buildUserPrompt } from './prompt';
import { captureLeadTool, escalateToHumanTool } from './tools';

const MCP_SERVER_NAME = 'portal';
const ALLOWED_BUILTIN_TOOLS = ['Read', 'Glob', 'Grep'];
const HISTORY_LIMIT = 50;
const MAX_TURNS = 12;

@Injectable()
export class AgentWorkerService {
  private readonly log = new Logger(AgentWorkerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly conversations: ConversationsService,
    private readonly businesses: BusinessesService,
    private readonly leads: LeadsService,
    private readonly filesystem: FilesystemService,
    private readonly channels: ChannelRegistry,
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

    await this.filesystem.ensureBusinessRoot(business.id);
    const cwd = this.filesystem.businessRoot(business.id);

    const history = await this.conversations.listMessages(
      business.id,
      conversation.id,
      { limit: HISTORY_LIMIT },
    );

    const systemPrompt = buildSystemPrompt(business);
    const userPrompt = buildUserPrompt(history);
    const model = this.config.get<string>('AGENT_MODEL', 'claude-sonnet-4-6');

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

    const allowedTools = [
      ...ALLOWED_BUILTIN_TOOLS,
      `mcp__${MCP_SERVER_NAME}__capture_lead`,
      `mcp__${MCP_SERVER_NAME}__escalate_to_human`,
    ];

    // Defense in depth: cwd is not a filesystem jail. Block Read/Glob/Grep
    // calls whose path argument resolves outside the per-business root, so a
    // misbehaving model can't reach into another tenant's files via absolute
    // paths or "../" traversal.
    const isPathInsideCwd = (target: string | undefined): boolean => {
      if (!target) return true;
      const resolved = path.resolve(cwd, target);
      return resolved === cwd || resolved.startsWith(cwd + path.sep);
    };

    let finalText = '';
    let apiError: { subtype: string; detail?: string } | undefined;

    const controller = new AbortController();
    const q = query({
      prompt: userPrompt,
      options: {
        cwd,
        model,
        systemPrompt,
        tools: ALLOWED_BUILTIN_TOOLS,
        allowedTools,
        mcpServers: { [MCP_SERVER_NAME]: mcpServer },
        settingSources: [],
        persistSession: false,
        permissionMode: 'dontAsk',
        maxTurns: MAX_TURNS,
        abortController: controller,
        canUseTool: async (toolName, input) => {
          if (ALLOWED_BUILTIN_TOOLS.includes(toolName)) {
            const i = input as Record<string, unknown>;
            const candidates = [i.file_path, i.path].filter(
              (v): v is string => typeof v === 'string',
            );
            for (const target of candidates) {
              if (!isPathInsideCwd(target)) {
                return {
                  behavior: 'deny',
                  message: `Access outside the business directory is not allowed (${target})`,
                };
              }
            }
          }
          return { behavior: 'allow', updatedInput: input };
        },
      },
    });

    try {
      for await (const msg of q) {
        if (msg.type === 'system' && msg.subtype === 'init') {
          this.log.debug(
            `Agent init for conversation ${conversation.id}: apiKeySource=${msg.apiKeySource} model=${model} cwd=${cwd}`,
          );
        } else if (
          msg.type === 'system' &&
          msg.subtype === 'permission_denied'
        ) {
          this.log.warn(
            `Tool denied for conversation ${conversation.id}: tool=${msg.tool_name}`,
          );
        } else if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            finalText = msg.result;
          } else {
            apiError = {
              subtype: msg.subtype,
              detail: msg.errors?.join('; '),
            };
          }
        }
      }
    } catch (err) {
      this.log.error(
        `Agent run failed for conversation ${conversation.id}: ${(err as Error).message}`,
      );
      throw err;
    } finally {
      controller.abort();
    }

    if (apiError) {
      // Throw so BullMQ retries with backoff. Out-of-budget errors are non-
      // retriable in spirit, but they're rare and the queue's retry cap will
      // bound the damage; we still log loudly.
      this.log.error(
        `Agent run for conversation ${conversation.id} failed: subtype=${apiError.subtype} detail=${apiError.detail ?? 'n/a'}`,
      );
      throw new Error(
        `Agent run failed (${apiError.subtype})${apiError.detail ? `: ${apiError.detail}` : ''}`,
      );
    }
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
        // Best-effort: stash external id so future inbound dedupe can match.
        reply.externalMessageId = result.externalMessageId;
      }
    } catch (err) {
      this.log.warn(
        `Channel dispatch skipped for ${refreshed.channel}: ${(err as Error).message}`,
      );
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { AgentRunner } from '../agents/agent-runner.service';
import { BusinessesService } from '../businesses/businesses.service';
import { FilesystemService } from '../context-files/filesystem.service';
import { TasksService } from '../tasks/tasks.service';
import {
  ChatTurn,
  buildRemindersSystemPrompt,
  buildRemindersUserPrompt,
} from './agent/prompt';
import {
  ToolContext,
  completeReminderTool,
  createReminderTool,
  deleteReminderTool,
  listRemindersTool,
  snoozeReminderTool,
} from './agent/tools';

const MCP_SERVER_NAME = 'reminders';

export interface RemindersChatInput {
  businessId: string;
  userId?: string | null;
  history: ChatTurn[];
}

export interface RemindersChatResult {
  reply: string;
  /** True if a reminder was created/changed — the UI refetches the list. */
  changed: boolean;
}

@Injectable()
export class RemindersAgentService {
  constructor(
    private readonly runner: AgentRunner,
    private readonly businesses: BusinessesService,
    private readonly tasks: TasksService,
    private readonly filesystem: FilesystemService,
  ) {}

  async chat(input: RemindersChatInput): Promise<RemindersChatResult> {
    const business = await this.businesses.findById(input.businessId);
    if (!business) {
      throw new NotFoundException(`Business ${input.businessId} not found`);
    }

    await this.filesystem.ensureBusinessRoot(business.id);
    const cwd = this.filesystem.businessRoot(business.id);

    const open = (await this.tasks.list(business.id)).filter(
      (t) => t.status !== 'done',
    );

    const toolCtx: ToolContext = {
      businessId: business.id,
      userId: input.userId ?? null,
      tasks: this.tasks,
      changed: false,
    };

    const mcpServer = createSdkMcpServer({
      name: MCP_SERVER_NAME,
      version: '0.1.0',
      tools: [
        listRemindersTool(toolCtx),
        createReminderTool(toolCtx),
        completeReminderTool(toolCtx),
        snoozeReminderTool(toolCtx),
        deleteReminderTool(toolCtx),
      ],
    });

    const { finalText } = await this.runner.run({
      systemPrompt: buildRemindersSystemPrompt(business, open),
      prompt: buildRemindersUserPrompt(input.history),
      cwd,
      mcpServers: { [MCP_SERVER_NAME]: mcpServer },
      allowedMcpTools: [
        `mcp__${MCP_SERVER_NAME}__list_reminders`,
        `mcp__${MCP_SERVER_NAME}__create_reminder`,
        `mcp__${MCP_SERVER_NAME}__complete_reminder`,
        `mcp__${MCP_SERVER_NAME}__snooze_reminder`,
        `mcp__${MCP_SERVER_NAME}__delete_reminder`,
      ],
      runLabel: `reminders-agent business=${business.id}`,
    });

    return { reply: finalText, changed: toolCtx.changed };
  }
}

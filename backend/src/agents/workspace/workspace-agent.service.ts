import { Injectable, NotFoundException } from '@nestjs/common';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { AgentRunner } from '../agent-runner.service';
import { AgentsService } from '../agents.service';
import { BusinessesService } from '../../businesses/businesses.service';
import { FilesystemService } from '../../context-files/filesystem.service';
import { TasksService } from '../../tasks/tasks.service';
import { LeadsService } from '../../leads/leads.service';
import { BillingService } from '../../billing/billing.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { WorkspaceAgentKey } from './workspace-agent.constants';
import {
  WORKSPACE_AGENT_CONFIGS,
  buildWorkspaceSystemPrompt,
  buildWorkspaceUserPrompt,
} from './workspace-agent.configs';
import { AgentSuggestion, WorkspaceToolContext } from './workspace-agent.tools';

export interface WorkspaceChatInput {
  businessId: string;
  userId?: string | null;
  history: { role: 'user' | 'assistant'; content: string }[];
}

export interface WorkspaceChatResult {
  reply: string;
  changed: boolean;
  suggestions: AgentSuggestion[];
}

/**
 * Generic executor for the "workspace" agents (marketing, analytics, sales,
 * crm, quote, accounting, orchestrator). One code path; per-agent behavior comes
 * entirely from WORKSPACE_AGENT_CONFIGS. Tools operate on the real domain
 * services, so their actions are first-class records shared with the rest of
 * the app.
 */
@Injectable()
export class WorkspaceAgentService {
  constructor(
    private readonly runner: AgentRunner,
    private readonly agents: AgentsService,
    private readonly businesses: BusinessesService,
    private readonly filesystem: FilesystemService,
    private readonly tasks: TasksService,
    private readonly leads: LeadsService,
    private readonly billing: BillingService,
    private readonly expenses: ExpensesService,
  ) {}

  async chat(
    agentKey: WorkspaceAgentKey,
    input: WorkspaceChatInput,
  ): Promise<WorkspaceChatResult> {
    const config = WORKSPACE_AGENT_CONFIGS[agentKey];
    const business = await this.businesses.findById(input.businessId);
    if (!business) {
      throw new NotFoundException(`Business ${input.businessId} not found`);
    }

    await this.filesystem.ensureBusinessRoot(business.id);
    const cwd = this.filesystem.businessRoot(business.id);

    const ctx: WorkspaceToolContext = {
      businessId: business.id,
      userId: input.userId ?? null,
      changed: false,
      tasks: this.tasks,
      leads: this.leads,
      billing: this.billing,
      expenses: this.expenses,
      entitled: await this.agents.entitledForBusiness(business.id),
      suggestions: [],
    };

    const mcpServer = createSdkMcpServer({
      name: config.mcpName,
      version: '0.1.0',
      tools: config.tools(ctx),
    });

    const { finalText } = await this.runner.run({
      systemPrompt: buildWorkspaceSystemPrompt(config, business),
      prompt: buildWorkspaceUserPrompt(input.history),
      cwd,
      mcpServers: { [config.mcpName]: mcpServer },
      allowedMcpTools: config.allowedToolNames(config.mcpName),
      runLabel: `workspace:${agentKey} business=${business.id}`,
    });

    return {
      reply: finalText,
      changed: ctx.changed,
      suggestions: ctx.suggestions,
    };
  }
}

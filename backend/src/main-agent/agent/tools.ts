import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  AgentDefinition,
  getAgentDefinition,
} from '../../agents/agent-catalog';
import { NotificationsService } from '../../notifications/notifications.service';
import { SupportRequestsService } from '../../support/support-requests.service';

export interface AgentSuggestion {
  key: string;
  name: string;
  reason: string;
}

export interface ToolContext {
  businessId: string;
  userId?: string | null;
  /** Agents this business may actually use — the allowlist for suggestions. */
  entitled: AgentDefinition[];
  support: SupportRequestsService;
  notifications: NotificationsService;
  /** Collected during the run and read by the endpoint. */
  suggestions: AgentSuggestion[];
  ticketCreated: boolean;
}

export function suggestAgentTool(ctx: ToolContext) {
  return tool(
    'suggest_agent',
    'Recommend a specialist agent to the owner. The interface renders a button that opens it. Only use keys from the available-agents list.',
    {
      agent_key: z
        .string()
        .describe(
          'The key of the agent to recommend (from the available list).',
        ),
      reason: z
        .string()
        .describe('One short Hebrew line on why this agent helps here.'),
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- SDK tool handler must return a Promise
    async (args) => {
      const allowed = ctx.entitled.some((a) => a.key === args.agent_key);
      if (!allowed) {
        return {
          content: [
            {
              type: 'text',
              text: `Agent "${args.agent_key}" is not available to this business — do not suggest it. Pick one from the available list, or none.`,
            },
          ],
        };
      }
      const def = getAgentDefinition(args.agent_key);
      if (!ctx.suggestions.some((s) => s.key === args.agent_key)) {
        ctx.suggestions.push({
          key: args.agent_key,
          name: def?.name ?? args.agent_key,
          reason: args.reason,
        });
      }
      return {
        content: [
          {
            type: 'text',
            text: `Suggested "${def?.name ?? args.agent_key}". A button was shown to the owner. Mention it briefly in your Hebrew reply.`,
          },
        ],
      };
    },
  );
}

export function openSupportRequestTool(ctx: ToolContext) {
  return tool(
    'open_support_request',
    'File a technical/support request to the Portal Studio team (the operator). Use for bugs, broken things, or requests you cannot fulfil yourself.',
    {
      subject: z.string().describe('Short subject line (Hebrew).'),
      details: z
        .string()
        .describe(
          'What the owner needs or what went wrong, in their words (Hebrew).',
        ),
    },
    async (args) => {
      await ctx.support.create({
        businessId: ctx.businessId,
        createdByUserId: ctx.userId ?? null,
        subject: args.subject,
        details: args.details,
      });
      await ctx.notifications.notify({
        businessId: ctx.businessId,
        type: 'system',
        title: 'הפנייה נשלחה לצוות Portal Studio',
        body: args.subject,
      });
      ctx.ticketCreated = true;
      return {
        content: [
          {
            type: 'text',
            text: 'Support request filed and routed to the Portal Studio operator. Tell the owner in Hebrew that it was sent and someone will get back to them.',
          },
        ],
      };
    },
  );
}

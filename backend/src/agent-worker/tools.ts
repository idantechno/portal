import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { ConversationsService } from '../conversations/conversations.service';
import { LeadsService } from '../leads/leads.service';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
import { MessageRole } from '../common/enums/message-role.enum';

/**
 * Tools exposed to the agent via an in-process MCP server. The agent only
 * sees the schemas declared here — `businessId`, `conversationId`, and the
 * service handles are captured in closure and never passed by the model.
 */

export interface ToolContext {
  businessId: string;
  conversationId: string;
  customerContactId: string;
  leads: LeadsService;
  conversations: ConversationsService;
}

export function captureLeadTool(ctx: ToolContext) {
  return tool(
    'capture_lead',
    'Capture a lead when the customer wants follow-up: a callback, a quote, more information, or has expressed buying intent. Always confirm details with the customer before calling this.',
    {
      name: z.string().describe("Customer's name as they provided it"),
      phone: z
        .string()
        .optional()
        .describe('Phone number including country code if known'),
      email: z.string().optional().describe('Email address'),
      interest: z
        .string()
        .describe(
          'Short summary of what the customer is interested in (product, service, question).',
        ),
      notes: z
        .string()
        .optional()
        .describe('Any extra context that would help a human follow up.'),
    },
    async (args) => {
      const lead = await ctx.leads.create({
        businessId: ctx.businessId,
        conversationId: ctx.conversationId,
        customerContactId: ctx.customerContactId,
        name: args.name,
        phone: args.phone ?? null,
        email: args.email ?? null,
        interest: args.interest,
        notes: args.notes ?? null,
      });
      return {
        content: [
          {
            type: 'text',
            text: `Lead saved (id=${lead.id}). Now thank the customer in their language and tell them someone from the team will get back to them shortly.`,
          },
        ],
      };
    },
  );
}

export function escalateToHumanTool(ctx: ToolContext) {
  return tool(
    'escalate_to_human',
    'Hand the conversation over to a human team member. Use when the customer asks for a human, complains, the issue is sensitive, or you cannot help confidently. After calling this, the bot will stop responding until a human takes over.',
    {
      reason: z
        .string()
        .describe(
          "Short reason for the escalation (e.g. 'customer requested human', 'complex billing issue').",
        ),
      summary: z
        .string()
        .describe(
          'One-paragraph summary of the conversation so the human agent has context.',
        ),
    },
    async (args) => {
      await ctx.conversations.setStatus(
        ctx.businessId,
        ctx.conversationId,
        ConversationStatus.Human,
        null,
      );
      await ctx.conversations.appendMessage({
        businessId: ctx.businessId,
        conversationId: ctx.conversationId,
        role: MessageRole.System,
        content: `[escalated] ${args.reason}\n\n${args.summary}`,
        contentJson: {
          kind: 'escalation',
          reason: args.reason,
          summary: args.summary,
        },
      });
      return {
        content: [
          {
            type: 'text',
            text: 'Escalation recorded. Now tell the customer in their language that a team member will continue the conversation shortly. Keep the message short and warm.',
          },
        ],
      };
    },
  );
}

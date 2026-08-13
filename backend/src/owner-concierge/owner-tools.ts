import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { TasksService } from '../tasks/tasks.service';
import { CustomersService } from '../customers/customers.service';
import { LeadsService } from '../leads/leads.service';
import { parseIsraelDate } from '../common/time/israel-time';

/** Service handles + tenant scope, captured in closure — never seen by the model. */
export interface OwnerToolContext {
  businessId: string;
  tasks: TasksService;
  customers: CustomersService;
  leads: LeadsService;
}

export const OWNER_MCP_SERVER_NAME = 'owner';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

/**
 * The action toolbox the owner's WhatsApp concierge can use. Every tool acts on
 * the owner's OWN business (businessId is captured, never passed by the model)
 * and returns a short Hebrew confirmation the agent reads back to the owner.
 */
export function buildOwnerMcpServer(ctx: OwnerToolContext) {
  const createTask = tool(
    'create_task',
    'Create a to-do TASK for the owner (something that takes time / goes on the calendar). Use for real work items — "לקבוע פגישה עם הספק", "להכין הצעת מחיר". If the owner gives a time it lands on the calendar.',
    {
      title: z.string().min(1).describe('The task, in Hebrew.'),
      due_at: z
        .string()
        .optional()
        .describe(
          'Optional due time — ISO Israel local, no timezone (e.g. "2026-08-13T10:00"). Resolve relative times ("מחר בעשר") yourself. Omit for an undated to-do.',
        ),
      priority: z
        .enum(['high', 'medium', 'low'])
        .optional()
        .describe('Priority. Default medium.'),
    },
    async (args) => {
      const dueAt = args.due_at ? parseIsraelDate(args.due_at) : null;
      await ctx.tasks.create({
        businessId: ctx.businessId,
        title: args.title,
        dueAt: dueAt ?? undefined,
        priority: args.priority ?? 'medium',
        kind: 'task',
        source: 'agent',
      });
      return ok(`נוצרה משימה: ${args.title}`);
    },
  );

  const createReminder = tool(
    'create_reminder',
    'Create a REMINDER (a nudge — "תזכיר לי ל..."). Unlike a task it does not take calendar time; the owner just gets pinged at the set time. Use for "תזכיר לי מחר להתקשר ליוסי".',
    {
      title: z.string().min(1).describe('What to remind, in Hebrew.'),
      remind_at: z
        .string()
        .describe(
          'When to nudge — ISO Israel local, no timezone (e.g. "2026-08-13T09:00"). Resolve relative times yourself.',
        ),
    },
    async (args) => {
      const at = parseIsraelDate(args.remind_at);
      if (!at)
        return ok('לא הבנתי את הזמן לתזכורת — אפשר לנסות שוב עם שעה מדויקת?');
      await ctx.tasks.create({
        businessId: ctx.businessId,
        title: args.title,
        dueAt: at,
        remindAt: at,
        remindEnabled: true,
        kind: 'reminder',
        source: 'agent',
      });
      return ok(`אזכיר לך: ${args.title}`);
    },
  );

  const createCustomer = tool(
    'create_customer',
    'Add a CUSTOMER to the CRM (a paying/active client the owner works with). Use for "תוסיף לקוח...".',
    {
      name: z.string().min(1).describe("Customer's name, in Hebrew."),
      phone: z.string().optional().describe('Phone, if given.'),
      email: z.string().optional().describe('Email, if given.'),
      notes: z.string().optional().describe('Any note the owner added.'),
    },
    async (args) => {
      await ctx.customers.create(ctx.businessId, {
        name: args.name,
        phone: args.phone,
        email: args.email,
        notes: args.notes,
      });
      return ok(`נוסף לקוח: ${args.name}`);
    },
  );

  const createLead = tool(
    'create_lead',
    'Add a LEAD (a potential customer / sales opportunity, not yet a client). Use for "תוסיף ליד..." / "פנה אליי מתעניין...".',
    {
      name: z.string().min(1).describe("Lead's name, in Hebrew."),
      interest: z
        .string()
        .min(1)
        .describe('What they are interested in, in Hebrew.'),
      phone: z.string().optional().describe('Phone, if given.'),
      email: z.string().optional().describe('Email, if given.'),
    },
    async (args) => {
      await ctx.leads.create({
        businessId: ctx.businessId,
        name: args.name,
        interest: args.interest,
        phone: args.phone,
        email: args.email,
        source: 'agent',
        sourceDetail: 'וואטסאפ — בעל העסק',
      });
      return ok(`נוסף ליד: ${args.name}`);
    },
  );

  const server = createSdkMcpServer({
    name: OWNER_MCP_SERVER_NAME,
    version: '1.0.0',
    tools: [createTask, createReminder, createCustomer, createLead],
  });

  const allowedToolNames = [
    'create_task',
    'create_reminder',
    'create_customer',
    'create_lead',
  ].map((n) => `mcp__${OWNER_MCP_SERVER_NAME}__${n}`);

  return { server, allowedToolNames };
}

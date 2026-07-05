import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { TasksService } from '../../tasks/tasks.service';
import { LeadsService } from '../../leads/leads.service';
import { BillingService } from '../../billing/billing.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { AgentDefinition, getAgentDefinition } from '../agent-catalog';
import { parseIsraelDate } from '../../common/time/israel-time';

export interface AgentSuggestion {
  key: string;
  name: string;
  reason: string;
}

/**
 * Shared context handed to every workspace tool. The services are the SAME ones
 * the rest of the app uses, so a tool action (a task, an invoice, a note) is a
 * first-class record — not an agent-only silo. `changed` flips when a tool
 * mutates data so the UI refetches; `suggestions` collects orchestrator routes.
 */
export interface WorkspaceToolContext {
  businessId: string;
  userId?: string | null;
  changed: boolean;
  tasks: TasksService;
  leads: LeadsService;
  billing: BillingService;
  expenses: ExpensesService;
  entitled: AgentDefinition[];
  suggestions: AgentSuggestion[];
}

const ils = (cents: number) => `₪${(cents / 100).toLocaleString('he-IL')}`;

function isThisMonth(d: Date | null | undefined): boolean {
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

/** Adds a dated item to the business's schedule (its tasks). Shared by the
 *  marketing "schedule this" and analytics "action item" flows. */
export function addToScheduleTool(ctx: WorkspaceToolContext) {
  return tool(
    'add_to_schedule',
    'Adds a dated item to the business schedule (the tasks list). Use to schedule a post, a follow-up, or any action the owner agrees to.',
    {
      title: z.string().min(1).max(200).describe('Short title (Hebrew).'),
      due_date: z
        .string()
        .max(40)
        .optional()
        .describe('ISO date/time, e.g. "2026-07-12" or "2026-07-12T10:00".'),
      note: z.string().max(2000).optional().describe('Optional detail.'),
    },
    async (args) => {
      const task = await ctx.tasks.create({
        businessId: ctx.businessId,
        title: args.title,
        description: args.note ?? null,
        dueAt: args.due_date ? parseIsraelDate(args.due_date) : null,
        source: 'agent',
        createdByUserId: ctx.userId ?? null,
      });
      ctx.changed = true;
      return {
        content: [
          {
            type: 'text',
            text: `Added to the schedule (id=${task.id}). Confirm briefly in Hebrew.`,
          },
        ],
      };
    },
  );
}

export function listLeadsTool(ctx: WorkspaceToolContext) {
  return tool(
    'list_leads',
    'Returns the business leads (id, name, interest, phone, notes, created date) — newest first.',
    {},
    async () => {
      const rows = await ctx.leads.list(ctx.businessId);
      const payload = rows.slice(0, 100).map((l) => ({
        id: l.id,
        name: l.name,
        interest: l.interest,
        phone: l.phone,
        notes: l.notes,
        created_at: l.createdAt?.toISOString?.() ?? null,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}

export function setFollowupTool(ctx: WorkspaceToolContext) {
  return tool(
    'set_followup',
    'Creates a dated follow-up reminder for a lead (stored as a task linked to that lead). Find the lead id with list_leads first.',
    {
      title: z.string().min(1).max(200).describe('What to do (Hebrew).'),
      lead_id: z.string().max(64).optional().describe('Linked lead id.'),
      due_date: z.string().max(40).optional().describe('ISO date/time.'),
    },
    async (args) => {
      const task = await ctx.tasks.create({
        businessId: ctx.businessId,
        title: args.title,
        dueAt: args.due_date ? parseIsraelDate(args.due_date) : null,
        source: 'agent',
        createdByUserId: ctx.userId ?? null,
        relatedType: args.lead_id ? 'lead' : null,
        relatedId: args.lead_id ?? null,
      });
      ctx.changed = true;
      return {
        content: [
          {
            type: 'text',
            text: `Follow-up set (id=${task.id}). Confirm briefly in Hebrew.`,
          },
        ],
      };
    },
  );
}

export function logLeadNoteTool(ctx: WorkspaceToolContext) {
  return tool(
    'log_lead_note',
    'Sets/updates the notes on a lead (CRM record keeping). Find the id with list_leads first. Pass the FULL note text you want stored.',
    {
      lead_id: z.string().max(64).describe('The lead id to update.'),
      notes: z.string().max(4000).describe('The full notes text to store.'),
    },
    async (args) => {
      await ctx.leads.updateNotes(ctx.businessId, args.lead_id, args.notes);
      ctx.changed = true;
      return {
        content: [
          { type: 'text', text: 'Lead notes updated. Confirm briefly.' },
        ],
      };
    },
  );
}

export function listInvoicesTool(ctx: WorkspaceToolContext) {
  return tool(
    'list_invoices',
    'Returns the business invoices (id, number, status, amount, customer, issued date) — newest first.',
    {},
    async () => {
      const rows = await ctx.billing.listInvoices(ctx.businessId);
      const payload = rows.slice(0, 100).map((i) => ({
        id: i.id,
        number: i.number,
        status: i.status,
        amount: ils(i.amountCents),
        customer: i.customerName,
        issued_at: i.issuedAt?.toISOString?.() ?? null,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}

export function createInvoiceTool(ctx: WorkspaceToolContext) {
  return tool(
    'create_invoice',
    'Creates a DRAFT invoice from line items. Prices are in shekels (₪). Returns the invoice number and total.',
    {
      customer_name: z.string().max(200).optional().describe('Customer name.'),
      line_items: z
        .array(
          z.object({
            description: z.string().min(1).max(300),
            quantity: z.number().min(1).max(100000),
            unit_price_ils: z
              .number()
              .min(0)
              .max(10000000)
              .describe('Unit price in SHEKELS (not agorot).'),
          }),
        )
        .min(1)
        .max(50)
        .describe('At least one priced line.'),
      due_date: z.string().max(40).optional().describe('ISO due date.'),
    },
    async (args) => {
      const invoice = await ctx.billing.createInvoice(ctx.businessId, {
        customerName: args.customer_name,
        dueAt: args.due_date,
        lineItems: args.line_items.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPriceCents: Math.round(l.unit_price_ils * 100),
        })),
      });
      ctx.changed = true;
      return {
        content: [
          {
            type: 'text',
            text: `Draft invoice ${invoice.number} created, total ${ils(invoice.amountCents)}. Tell the owner in Hebrew and mention they can review/send it in the חיוב screen.`,
          },
        ],
      };
    },
  );
}

export function markInvoicePaidTool(ctx: WorkspaceToolContext) {
  return tool(
    'mark_invoice_paid',
    'Marks an invoice as paid. Find its id with list_invoices first.',
    { invoice_id: z.string().max(64).describe('The invoice id.') },
    async (args) => {
      const inv = await ctx.billing.markInvoicePaid(
        ctx.businessId,
        args.invoice_id,
      );
      ctx.changed = true;
      return {
        content: [
          {
            type: 'text',
            text: `Invoice ${inv.number} marked paid. Confirm briefly in Hebrew.`,
          },
        ],
      };
    },
  );
}

export function financeSummaryTool(ctx: WorkspaceToolContext) {
  return tool(
    'finance_summary',
    'Computes this-month income (paid invoices) vs tracked expenses, plus outstanding unpaid invoices. Use for "how am I doing this month".',
    {},
    async () => {
      const [invoices, expenseSummary] = await Promise.all([
        ctx.billing.listInvoices(ctx.businessId),
        ctx.expenses.summary(ctx.businessId),
      ]);
      const paidThisMonth = invoices
        .filter((i) => i.status === 'paid' && isThisMonth(i.paidAt ?? null))
        .reduce((s, i) => s + i.amountCents, 0);
      const outstanding = invoices
        .filter((i) => i.status !== 'paid' && i.status !== 'void')
        .reduce((s, i) => s + i.amountCents, 0);
      const expenses = expenseSummary.monthlyTotalCents;
      const net = paidThisMonth - expenses;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                income_this_month: ils(paidThisMonth),
                expenses_this_month: ils(expenses),
                net_this_month: ils(net),
                outstanding_unpaid: ils(outstanding),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

export function businessSnapshotTool(ctx: WorkspaceToolContext) {
  return tool(
    'business_snapshot',
    'Computes a live weekly snapshot from the business data: open tasks, overdue tasks, new leads this month, income vs expenses this month. Use it before giving insights.',
    {},
    async () => {
      const now = new Date();
      const [tasks, leads, invoices, expenseSummary] = await Promise.all([
        ctx.tasks.list(ctx.businessId),
        ctx.leads.list(ctx.businessId),
        ctx.billing.listInvoices(ctx.businessId),
        ctx.expenses.summary(ctx.businessId),
      ]);
      const open = tasks.filter((t) => t.status !== 'done');
      const overdue = open.filter((t) => t.dueAt && t.dueAt < now);
      const newLeads = leads.filter((l) => isThisMonth(l.createdAt));
      const income = invoices
        .filter((i) => i.status === 'paid' && isThisMonth(i.paidAt ?? null))
        .reduce((s, i) => s + i.amountCents, 0);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                open_tasks: open.length,
                overdue_tasks: overdue.length,
                new_leads_this_month: newLeads.length,
                income_this_month: ils(income),
                expenses_this_month: ils(expenseSummary.monthlyTotalCents),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

export function routeToAgentTool(ctx: WorkspaceToolContext) {
  return tool(
    'route_to_agent',
    "Recommend the specialist agent that best fits the owner's need. The UI renders a button that opens it. Only use keys from the available-agents list.",
    {
      agent_key: z.string().max(40).describe('Key of the agent to route to.'),
      reason: z.string().max(300).describe('One short Hebrew line on why.'),
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- SDK handler must be async
    async (args) => {
      const allowed = ctx.entitled.some((a) => a.key === args.agent_key);
      if (!allowed) {
        return {
          content: [
            {
              type: 'text',
              text: `Agent "${args.agent_key}" is not available to this business — pick one from the available list, or none.`,
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
            text: `Routed to "${def?.name ?? args.agent_key}". A button was shown to the owner — mention it briefly in Hebrew.`,
          },
        ],
      };
    },
  );
}

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { TasksService } from '../tasks/tasks.service';
import { CustomersService } from '../customers/customers.service';
import { LeadsService } from '../leads/leads.service';
import { ExpensesService } from '../expenses/expenses.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { ScheduleService } from '../schedule/schedule.service';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { parseIsraelDate } from '../common/time/israel-time';

/** Service handles + tenant scope, captured in closure — never seen by the model. */
export interface OwnerToolContext {
  businessId: string;
  tasks: TasksService;
  customers: CustomersService;
  leads: LeadsService;
  expenses: ExpensesService;
  appointments: AppointmentsService;
  schedule: ScheduleService;
  scheduledMessages: ScheduledMessagesService;
}

export const OWNER_MCP_SERVER_NAME = 'owner';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

/** A resolved recipient for an outbound message. */
interface Recipient {
  phone: string;
  name: string | null;
}

/** Reduce a phone to digits-only, keeping enough to be a real number. */
function looksLikePhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 7;
}

/** Israel wall-clock day label for agenda/confirmation text. */
function dayLabel(at: Date): string {
  return at.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The action toolbox the owner's WhatsApp concierge can use. Every tool acts on
 * the owner's OWN business (businessId is captured, never passed by the model)
 * and returns a short Hebrew confirmation the agent reads back to the owner.
 */
export function buildOwnerMcpServer(ctx: OwnerToolContext) {
  /**
   * Find a contact by name across customers then leads. Returns every match so
   * the caller can disambiguate or ask for a phone when there's no clear hit.
   */
  const findContacts = async (
    name: string,
  ): Promise<Array<{ name: string; phone: string | null; kind: string }>> => {
    const needle = name.trim().toLowerCase();
    if (!needle) return [];
    const [customers, leads] = await Promise.all([
      ctx.customers.list(ctx.businessId),
      ctx.leads.list(ctx.businessId),
    ]);
    const out: Array<{ name: string; phone: string | null; kind: string }> = [];
    for (const c of customers) {
      const label = (c.name ?? '').toLowerCase();
      const biz = (c.businessName ?? '').toLowerCase();
      if (label.includes(needle) || (biz && biz.includes(needle))) {
        out.push({
          name: c.name ?? c.businessName ?? '',
          phone: c.phone,
          kind: 'לקוח',
        });
      }
    }
    for (const l of leads) {
      if ((l.name ?? '').toLowerCase().includes(needle)) {
        out.push({ name: l.name, phone: l.phone, kind: 'ליד' });
      }
    }
    return out;
  };

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
    'Create a REMINDER (a nudge for the OWNER — "תזכיר לי ל..."). Unlike a task it does not take calendar time; the owner just gets pinged at the set time. Use for "תזכיר לי מחר להתקשר ליוסי". This nudges the OWNER — it does NOT message anyone else; to message another person use send_message.',
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

  const sendMessage = tool(
    'send_message',
    'Send a WhatsApp message FROM the business TO another person (a customer / lead / any contact) — now or at a scheduled time. THIS is the tool for "תשלח ללינור...", "כתוב ללקוח X ש...", "תשלח מחר בערב ל...". Resolve the recipient by name (looked up in the CRM) or use an explicit phone. Provide send_at for a future send; omit it to send immediately. Do NOT turn such a request into a reminder — a reminder only pings the owner, it does not message the other person.',
    {
      message: z
        .string()
        .min(1)
        .describe('The message body to send, in Hebrew.'),
      recipient_name: z
        .string()
        .optional()
        .describe(
          "The recipient's name — looked up among customers/leads to find their phone.",
        ),
      recipient_phone: z
        .string()
        .optional()
        .describe(
          "The recipient's phone number, if the owner gave it directly. Wins over the name lookup.",
        ),
      send_at: z
        .string()
        .optional()
        .describe(
          'When to send — ISO Israel local, no timezone (e.g. "2026-08-13T20:30"). Resolve relative times ("מחר ב-20:30") yourself. Omit to send right now.',
        ),
    },
    async (args) => {
      // Resolve the recipient: an explicit phone wins; else look up the name.
      let recipient: Recipient | null = null;
      if (args.recipient_phone && looksLikePhone(args.recipient_phone)) {
        recipient = {
          phone: args.recipient_phone.trim(),
          name: args.recipient_name?.trim() || null,
        };
      } else if (args.recipient_name) {
        const matches = await findContacts(args.recipient_name);
        const withPhone = matches.filter(
          (m) => m.phone && looksLikePhone(m.phone),
        );
        if (withPhone.length === 0) {
          return ok(
            `לא מצאתי מספר טלפון ל"${args.recipient_name}". אפשר לשלוח לי את המספר ואשלח?`,
          );
        }
        if (withPhone.length > 1) {
          const list = withPhone
            .map((m) => `• ${m.name} (${m.kind}) — ${m.phone}`)
            .join('\n');
          return ok(
            `מצאתי כמה אנשי קשר בשם "${args.recipient_name}":\n${list}\nלמי לשלוח? אפשר לציין את המספר.`,
          );
        }
        recipient = {
          phone: withPhone[0].phone as string,
          name: withPhone[0].name,
        };
      } else {
        return ok('למי לשלוח? צריך שם איש קשר או מספר טלפון.');
      }

      const who = recipient.name || recipient.phone;

      // Scheduled send — persist it; the minute sweep delivers it when due.
      if (args.send_at) {
        const at = parseIsraelDate(args.send_at);
        if (!at)
          return ok('לא הבנתי את זמן השליחה — אפשר לנסות שוב עם תאריך ושעה?');
        await ctx.scheduledMessages.schedule({
          businessId: ctx.businessId,
          toPhone: recipient.phone,
          toName: recipient.name,
          body: args.message,
          sendAt: at,
        });
        return ok(
          `בוצע ✓ ההודעה ל${who} תישלח ב-${ScheduledMessagesService.whenLabel(at)}.`,
        );
      }

      // Immediate send.
      const res = await ctx.scheduledMessages.sendNow({
        businessId: ctx.businessId,
        toPhone: recipient.phone,
        toName: recipient.name,
        body: args.message,
      });
      if (res.delivered) return ok(`בוצע ✓ ההודעה נשלחה ל${who}.`);
      return ok(
        `לא הצלחתי לשלוח ל${who} כרגע — וואטסאפ מאפשר טקסט חופשי רק אם הנמען כתב לעסק ב-24 השעות האחרונות. ` +
          `אם לא, צריך לשלוח ידנית (${recipient.phone}).`,
      );
    },
  );

  const bookAppointment = tool(
    'book_appointment',
    'Book an APPOINTMENT / meeting on the owner\'s calendar (takes a time slot). Use for "תקבע לי פגישה עם יוסי מחר ב-3", "תזמן פגישה ללקוח...". Checks for clashes on the owner\'s timeline.',
    {
      title: z
        .string()
        .min(1)
        .describe('What the meeting is about, in Hebrew.'),
      start_at: z
        .string()
        .describe(
          'Start time — ISO Israel local, no timezone (e.g. "2026-08-14T15:00"). Resolve relative times yourself.',
        ),
      duration_minutes: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Length in minutes. Default 60.'),
      customer_name: z
        .string()
        .optional()
        .describe('Who the meeting is with, if given.'),
      phone: z.string().optional().describe('Their phone, if given.'),
      notes: z.string().optional().describe('Any note, in Hebrew.'),
    },
    async (args) => {
      const startAt = parseIsraelDate(args.start_at);
      if (!startAt) return ok('לא הבנתי את שעת הפגישה — אפשר לנסות שוב?');
      const endAt = new Date(
        startAt.getTime() + (args.duration_minutes ?? 60) * 60_000,
      );
      try {
        await ctx.appointments.book({
          businessId: ctx.businessId,
          title: args.title,
          startAt,
          endAt,
          customerName: args.customer_name ?? null,
          phone: args.phone ?? null,
          notes: args.notes ?? null,
          source: 'manual', // the owner's own booking — not restricted to open hours
        });
      } catch (err) {
        if ((err as Error).message.includes('SLOT_TAKEN')) {
          return ok(
            `יש כבר משהו ביומן ב-${dayLabel(startAt)}. לקבוע בכל זאת? אפשר לתת שעה אחרת.`,
          );
        }
        throw err;
      }
      const withWhom = args.customer_name ? ` עם ${args.customer_name}` : '';
      return ok(`בוצע ✓ נקבעה פגישה${withWhom} ל-${dayLabel(startAt)}.`);
    },
  );

  const logExpense = tool(
    'log_expense',
    'Record an EXPENSE from text (not a photo). Use for "רשום הוצאה 200 שקל על דלק", "תוסיף הוצאה קבועה 90 ש\'\'ח אחסון".',
    {
      title: z.string().min(1).describe('What the expense is for, in Hebrew.'),
      amount: z.number().positive().describe('Amount in shekels (₪).'),
      kind: z
        .enum(['fixed', 'occasional'])
        .optional()
        .describe(
          '"fixed" = recurring monthly; "occasional" = one-off. Default occasional.',
        ),
      date: z
        .string()
        .optional()
        .describe('Expense date YYYY-MM-DD, if given. Default today.'),
    },
    async (args) => {
      await ctx.expenses.create({
        businessId: ctx.businessId,
        title: args.title,
        amountCents: Math.round(args.amount * 100),
        kind: args.kind ?? 'occasional',
        expenseDate: args.date ?? null,
      });
      const amount = `₪${args.amount.toLocaleString('he-IL')}`;
      return ok(`נרשמה הוצאה: ${args.title} — ${amount}`);
    },
  );

  const getAgenda = tool(
    'get_agenda',
    'Look up what is on the owner\'s schedule (appointments + dated tasks + Google Calendar) for a time range. Use for "מה יש לי מחר?", "מה היום ביומן?".',
    {
      from: z
        .string()
        .optional()
        .describe('Range start — ISO Israel local, no timezone. Default: now.'),
      to: z
        .string()
        .optional()
        .describe(
          'Range end — ISO Israel local, no timezone. Default: 24h after "from".',
        ),
    },
    async (args) => {
      const from = (args.from && parseIsraelDate(args.from)) || new Date();
      const to =
        (args.to && parseIsraelDate(args.to)) ||
        new Date(from.getTime() + 24 * 60 * 60_000);
      const { items } = await ctx.schedule.agenda(ctx.businessId, from, to);
      if (items.length === 0) return ok('היומן פנוי בטווח הזה.');
      const lines = items
        .map((i) => `• ${dayLabel(new Date(i.start))} — ${i.title}`)
        .join('\n');
      return ok(`ביומן:\n${lines}`);
    },
  );

  const findContact = tool(
    'find_contact',
    'Look up a contact\'s phone/details by name (searches customers and leads). Use for "מה הטלפון של לינור?", "מי זה יוסי במערכת?".',
    {
      name: z.string().min(1).describe('The name to search for, in Hebrew.'),
    },
    async (args) => {
      const matches = await findContacts(args.name);
      if (matches.length === 0)
        return ok(`לא מצאתי איש קשר בשם "${args.name}".`);
      const lines = matches
        .map(
          (m) =>
            `• ${m.name} (${m.kind})${m.phone ? ` — ${m.phone}` : ' — אין טלפון'}`,
        )
        .join('\n');
      return ok(lines);
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

  const tools = [
    createTask,
    createReminder,
    sendMessage,
    bookAppointment,
    logExpense,
    getAgenda,
    findContact,
    createCustomer,
    createLead,
  ];

  const server = createSdkMcpServer({
    name: OWNER_MCP_SERVER_NAME,
    version: '1.0.0',
    tools,
  });

  const allowedToolNames = [
    'create_task',
    'create_reminder',
    'send_message',
    'book_appointment',
    'log_expense',
    'get_agenda',
    'find_contact',
    'create_customer',
    'create_lead',
  ].map((n) => `mcp__${OWNER_MCP_SERVER_NAME}__${n}`);

  return { server, allowedToolNames };
}

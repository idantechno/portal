import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { TasksService } from '../../tasks/tasks.service';
import { bucketFor } from '../buckets';
import { parseIsraelDate } from '../../common/time/israel-time';
import { computeRemindAt } from '../../common/time/reminder-window';
import type { BusinessReminderSettings } from '../../businesses/business.entity';

export interface ToolContext {
  businessId: string;
  userId?: string | null;
  tasks: TasksService;
  /** This business's reminder timing defaults, for the default remind time. */
  reminderSettings: BusinessReminderSettings | null;
  /** Set true when the run created/changed a reminder, so the UI refetches. */
  changed: boolean;
}

export function listRemindersTool(ctx: ToolContext) {
  return tool(
    'list_reminders',
    'Returns the open reminders (tasks) for this business with id, title, due date and bucket (overdue/today/soon/later/no_date).',
    {},
    async () => {
      const rows = await ctx.tasks.list(ctx.businessId);
      const now = new Date();
      const payload = rows
        .filter((t) => t.status !== 'done')
        .map((t) => ({
          id: t.id,
          title: t.title,
          due_at: t.dueAt ? t.dueAt.toISOString() : null,
          bucket: bucketFor(t.dueAt, now),
          related_type: t.relatedType,
          related_id: t.relatedId,
        }));
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}

export function createReminderTool(ctx: ToolContext) {
  return tool(
    'create_reminder',
    'Creates a reminder the owner will be nudged about (in-app + WhatsApp). CRITICAL: separate WHEN THE EVENT HAPPENS (event_date) from WHEN TO REMIND (remind_at / remind_before_hours). If the owner only gives an event time, leave remind_at and remind_before_hours empty and the default fires ~12h before within the business quiet hours. Use when the owner wants to be reminded of a task, follow-up, call or errand. To ALSO send the reminder over WhatsApp to another person — a customer, a lead, or anyone at all (the person need NOT be saved in the system) — pass remind_customer_phone with their number and remind_customer_name with their name. That person receives the reminder title as the message, so phrase the title as it should read to them (e.g. "לאסוף את ההזמנה מהחנות").',
    {
      title: z
        .string()
        .min(1)
        .describe(
          'What to remind about, phrased naturally in Hebrew (e.g. "לאסוף ציוד להשכרה", "להתקשר לדנה"). This exact text is what an extra recipient (remind_customer_phone) receives.',
        ),
      event_date: z
        .string()
        .optional()
        .describe(
          'When the thing actually happens, ISO Israel time, e.g. "2026-07-10" or "2026-07-10T12:00:00". Resolve relative days ("מחר") yourself.',
        ),
      remind_at: z
        .string()
        .optional()
        .describe(
          'Explicit time to FIRE the reminder, ISO Israel time. Use only if the owner gave an absolute reminder time.',
        ),
      remind_before_hours: z
        .number()
        .optional()
        .describe(
          'Remind this many hours BEFORE the event (e.g. owner said "תזכיר לי שעתיים לפני" → 2). Requires event_date. Ignored if remind_at is set.',
        ),
      related_type: z
        .string()
        .optional()
        .describe('Optional linked object type, e.g. "lead" or "document".'),
      related_id: z
        .string()
        .optional()
        .describe('Optional linked object id (uuid).'),
      remind_customer_phone: z
        .string()
        .optional()
        .describe(
          'Optional extra recipient\'s WhatsApp number (any format, e.g. "050-1234567"). When set, the reminder is ALSO sent to them over WhatsApp — they need not be a saved contact.',
        ),
      remind_customer_name: z
        .string()
        .optional()
        .describe("The extra recipient's name, to greet them personally."),
    },
    async (args) => {
      // ISO strings without an offset are Israel wall-clock time, not UTC.
      const eventAt = args.event_date ? parseIsraelDate(args.event_date) : null;
      let remindAt = args.remind_at ? parseIsraelDate(args.remind_at) : null;
      if (!remindAt && eventAt) {
        remindAt =
          args.remind_before_hours != null
            ? new Date(eventAt.getTime() - args.remind_before_hours * 3_600_000)
            : computeRemindAt(eventAt, ctx.reminderSettings);
      }
      // Shown as the event time; when there's no distinct event, it's the
      // reminder time itself so the message still carries a "when".
      const dueAt = eventAt ?? remindAt;
      const task = await ctx.tasks.create({
        businessId: ctx.businessId,
        title: args.title,
        dueAt,
        remindAt,
        remindEnabled: true,
        kind: 'reminder',
        source: 'agent',
        createdByUserId: ctx.userId ?? null,
        relatedType: args.related_type ?? null,
        relatedId: args.related_id ?? null,
        remindCustomerPhone: args.remind_customer_phone ?? null,
        remindCustomerName: args.remind_customer_name ?? null,
      });
      ctx.changed = true;
      const fires = remindAt
        ? ` It will remind at ${remindAt.toISOString()}.`
        : '';
      const alsoTo = args.remind_customer_phone
        ? ` It will ALSO be sent over WhatsApp to ${args.remind_customer_name ?? args.remind_customer_phone}.`
        : '';
      return {
        content: [
          {
            type: 'text',
            text: `Reminder created (id=${task.id}).${fires}${alsoTo} Confirm briefly in Hebrew, stating when you'll remind them${args.remind_customer_phone ? ' and that it will also reach that person on WhatsApp' : ''}.`,
          },
        ],
      };
    },
  );
}

export function completeReminderTool(ctx: ToolContext) {
  return tool(
    'complete_reminder',
    'Marks a reminder as done. Find the id with list_reminders first.',
    { id: z.string().describe('The reminder id to complete.') },
    async (args) => {
      await ctx.tasks.update(ctx.businessId, args.id, { status: 'done' });
      ctx.changed = true;
      return {
        content: [
          { type: 'text', text: 'Reminder marked done. Confirm briefly.' },
        ],
      };
    },
  );
}

export function snoozeReminderTool(ctx: ToolContext) {
  return tool(
    'snooze_reminder',
    'Pushes a reminder to tomorrow or to next week.',
    {
      id: z.string().describe('The reminder id to snooze.'),
      when: z.enum(['tomorrow', 'week']).describe('Snooze target.'),
    },
    async (args) => {
      const days = args.when === 'week' ? 7 : 1;
      const next = new Date(Date.now() + days * 86_400_000);
      // Snooze pushes the FIRE time; the event (dueAt) stays put.
      await ctx.tasks.update(ctx.businessId, args.id, { remindAt: next });
      ctx.changed = true;
      return {
        content: [
          {
            type: 'text',
            text: `Reminder snoozed to ${args.when}. Confirm briefly in Hebrew.`,
          },
        ],
      };
    },
  );
}

export function deleteReminderTool(ctx: ToolContext) {
  return tool(
    'delete_reminder',
    'Deletes a reminder permanently.',
    { id: z.string().describe('The reminder id to delete.') },
    async (args) => {
      await ctx.tasks.remove(ctx.businessId, args.id);
      ctx.changed = true;
      return {
        content: [{ type: 'text', text: 'Reminder deleted. Confirm briefly.' }],
      };
    },
  );
}

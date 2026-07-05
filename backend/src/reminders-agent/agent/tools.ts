import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { TasksService } from '../../tasks/tasks.service';
import { bucketFor } from '../buckets';
import { parseIsraelDate } from '../../common/time/israel-time';

export interface ToolContext {
  businessId: string;
  userId?: string | null;
  tasks: TasksService;
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
    'Creates a reminder for the business. Use when the owner wants to be reminded of a follow-up or task.',
    {
      title: z
        .string()
        .min(1)
        .describe('Short title of the reminder (Hebrew).'),
      due_date: z
        .string()
        .optional()
        .describe(
          'Due date in ISO format, e.g. "2026-07-10" or "2026-07-10T14:00:00".',
        ),
      related_type: z
        .string()
        .optional()
        .describe('Optional linked object type, e.g. "lead" or "document".'),
      related_id: z
        .string()
        .optional()
        .describe('Optional linked object id (uuid).'),
    },
    async (args) => {
      // A due_date without an offset is Israel wall-clock time, not UTC.
      const dueAt = args.due_date ? parseIsraelDate(args.due_date) : null;
      const task = await ctx.tasks.create({
        businessId: ctx.businessId,
        title: args.title,
        dueAt,
        source: 'agent',
        createdByUserId: ctx.userId ?? null,
        relatedType: args.related_type ?? null,
        relatedId: args.related_id ?? null,
      });
      ctx.changed = true;
      return {
        content: [
          {
            type: 'text',
            text: `Reminder created (id=${task.id}). Confirm briefly in Hebrew.`,
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
      const due = new Date(Date.now() + days * 86_400_000);
      await ctx.tasks.update(ctx.businessId, args.id, { dueAt: due });
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

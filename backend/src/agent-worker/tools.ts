import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { ConversationsService } from '../conversations/conversations.service';
import { LeadsService } from '../leads/leads.service';
import { CustomersService } from '../customers/customers.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { WaitlistService } from '../appointments/waitlist.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
import { ContactStatus } from '../common/enums/contact-status.enum';
import { MessageRole } from '../common/enums/message-role.enum';
import { Channel } from '../common/enums/channel.enum';
import { parseIsraelDate } from '../common/time/israel-time';

/**
 * Tools exposed to the agent via an in-process MCP server. The agent only
 * sees the schemas declared here — `businessId`, `conversationId`, and the
 * service handles are captured in closure and never passed by the model.
 */

export interface ToolContext {
  businessId: string;
  conversationId: string;
  customerContactId: string;
  /**
   * The matched CRM customer's id, when this contact is a registered customer.
   * Null for leads / unknown senders. Set by the worker AFTER the CRM lookup
   * resolves — the tool closures read it at call time, so `record_engagement`
   * sees the right value even though the mcp server is built earlier.
   */
  customerId?: string | null;
  /** Channel the conversation arrived on — recorded as the lead's origin. */
  channel?: Channel;
  leads: LeadsService;
  customers: CustomersService;
  conversations: ConversationsService;
  appointments: AppointmentsService;
  waitlist: WaitlistService;
  notifications: NotificationsService;
  tasks: TasksService;
}

/** Israel wall-clock rendering for confirmations the agent reads back. */
function formatIsraelTime(at: Date): string {
  return at.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Human-readable origin for a lead captured mid-conversation. */
function channelLabel(channel?: Channel): string {
  switch (channel) {
    case Channel.WhatsApp:
      return 'וואטסאפ';
    case Channel.Web:
      return "צ'אט באתר";
    default:
      return "צ'אט";
  }
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
        sourceDetail: channelLabel(ctx.channel),
      });

      // Also surface this lead in the unified people list and link it to the
      // conversation contact. Best-effort: a person-upsert hiccup must never
      // fail the capture the agent already promised the customer.
      await ctx.customers
        .upsertPerson(ctx.businessId, {
          name: args.name,
          phone: args.phone ?? null,
          email: args.email ?? null,
          stage: ContactStatus.Lead,
          source: 'agent',
          sourceDetail: channelLabel(ctx.channel),
          interest: args.interest,
          notes: args.notes ?? null,
          capturedData: {
            name: args.name,
            phone: args.phone ?? null,
            email: args.email ?? null,
            interest: args.interest,
            notes: args.notes ?? null,
          },
          customerContactId: ctx.customerContactId,
          leadId: lead.id,
          forceCreate: true,
        })
        .catch(() => undefined);

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

export function createReminderTool(ctx: ToolContext) {
  return tool(
    'create_reminder',
    "Create a reminder for the BUSINESS OWNER to follow up on something from THIS conversation — e.g. you promised the customer the owner would call back, the owner needs to prepare or send something, or a request needs the owner's action later. The owner gets nudged (in-app + WhatsApp) at the time you set — it flows into the business's תזכורות. Use sparingly, only for a real follow-up. This is internal: never tell the customer you created a reminder.",
    {
      title: z
        .string()
        .min(1)
        .describe(
          'What the owner should be reminded to do, phrased in Hebrew (e.g. "לחזור לדנה לגבי הצעת המחיר לחתונה").',
        ),
      remind_at: z
        .string()
        .describe(
          'When to nudge the owner — ISO Israel local time, no timezone (e.g. "2026-08-07T09:00"). Resolve relative times ("מחר בבוקר", "בעוד שעתיים") yourself.',
        ),
    },
    async (args) => {
      const at = parseIsraelDate(args.remind_at);
      if (!at) {
        return {
          content: [
            {
              type: 'text',
              text: 'The reminder time was unclear — skip it and just keep helping the customer.',
            },
          ],
        };
      }
      try {
        await ctx.tasks.create({
          businessId: ctx.businessId,
          title: args.title,
          dueAt: at,
          remindAt: at,
          remindEnabled: true,
          kind: 'reminder',
          source: 'agent',
        });
        return {
          content: [
            {
              type: 'text',
              text: "Reminder set for the owner. Don't mention it to the customer — just carry on naturally.",
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: 'text',
              text: "Couldn't set the reminder right now — carry on with the customer.",
            },
          ],
        };
      }
    },
  );
}

export function recordEngagementTool(ctx: ToolContext) {
  return tool(
    'record_engagement',
    "Record or update what THIS customer is actually getting from the business — the agreed engagement: a one-off job (e.g. a video clip), a specific project, or a plan/subscription and where they are with it. Derive it ONLY from what was actually agreed or offered in THIS conversation — never guess or invent. What you write is saved as a DRAFT that the business owner reviews and confirms, so keep it short, factual and specific: what they're getting, and whether it's a one-off or ongoing. Call this the moment the agreement becomes clear, or when it changes. This is an internal note — never mention it to the customer.",
    {
      summary: z
        .string()
        .describe(
          'Short factual summary of what this customer is getting — the agreed job/project/plan, in Hebrew. e.g. "קליפ אחד לרשתות — עבודה חד-פעמית, לא מנוי מערכת ולא שירות נוסף".',
        ),
    },
    async (args) => {
      if (!ctx.customerId) {
        return {
          content: [
            {
              type: 'text',
              text: "There's no customer record for this person yet, so there's nothing to attach an engagement to. If they're becoming a customer, use capture_lead to save their details; otherwise just keep helping them.",
            },
          ],
        };
      }
      try {
        const { changed } = await ctx.customers.recordEngagementByAgent(
          ctx.businessId,
          ctx.customerId,
          args.summary,
        );
        // Only nudge the owner on a real change — an identical re-record is a
        // no-op and must not spam the bell.
        if (changed) {
          void ctx.notifications
            .notify({
              businessId: ctx.businessId,
              type: 'system',
              title: 'הסוכן עדכן מה סוכם עם לקוח',
              body: `הסוכן רשם מה הלקוח מקבל: "${args.summary.trim()}". עבור ואשר שזה מדויק.`,
              link: `/app/businesses/${ctx.businessId}/customers/${ctx.customerId}`,
              channels: ['push'],
            })
            .catch(() => undefined);
        }
        return {
          content: [
            {
              type: 'text',
              text: 'Saved as a draft for the business owner to confirm. Do not tell the customer about this internal note — just carry on the conversation naturally.',
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: 'text',
              text: "Couldn't save that right now — carry on with the customer normally.",
            },
          ],
        };
      }
    },
  );
}

export function scheduleAppointmentTool(ctx: ToolContext) {
  return tool(
    'schedule_appointment',
    'Book an appointment for the customer (a clinic slot, studio session, or meeting). Only call this once the customer has agreed to a specific date and time. Confirm the details with them first. The appointment is added to the business calendar and the owner is notified.',
    {
      title: z
        .string()
        .describe(
          'What the appointment is for, e.g. "תספורת", "טיפול פנים", "פגישת ייעוץ". Include the customer name if known.',
        ),
      start: z
        .string()
        .describe(
          'Start date & time in Israel local time as ISO 8601 without timezone, e.g. "2026-07-28T15:00". Do NOT convert to UTC.',
        ),
      durationMinutes: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Length in minutes. Defaults to 60 if omitted.'),
      customerName: z
        .string()
        .optional()
        .describe("The customer's name, if known."),
      phone: z
        .string()
        .optional()
        .describe('Customer phone including country code, if provided.'),
      notes: z
        .string()
        .optional()
        .describe('Any extra detail for the appointment.'),
    },
    async (args) => {
      const startAt = parseIsraelDate(args.start);
      if (!startAt) {
        return {
          content: [
            {
              type: 'text',
              text: 'The start time could not be understood. Ask the customer to restate the day and time, then try again.',
            },
          ],
        };
      }
      const duration = args.durationMinutes ?? 60;
      const endAt = new Date(startAt.getTime() + duration * 60 * 1000);

      // Respect the business's opening hours: never book (or offer) a time the
      // business isn't open. The owner's manual bookings bypass this, but the
      // agent must not put a customer down for a closed slot.
      const avail = await ctx.appointments.isWithinAvailability(
        ctx.businessId,
        startAt,
        endAt,
      );
      if (!avail.ok) {
        const hours = avail.openHoursText
          ? `Open hours that day are ${avail.openHoursText}.`
          : 'The business is closed that day.';
        return {
          content: [
            {
              type: 'text',
              text: `That time (${formatIsraelTime(startAt)}) is outside the business's working hours. ${hours} Apologise and offer the customer a time within opening hours instead — do not book this one.`,
            },
          ],
        };
      }

      // Don't double-book: if the slot is taken, tell the agent to offer another
      // time, or to put the customer on the waitlist for this one.
      if (await ctx.appointments.hasConflict(ctx.businessId, startAt, endAt)) {
        return {
          content: [
            {
              type: 'text',
              text: `That slot (${formatIsraelTime(startAt)}) is already taken. Apologise, and either offer the customer a different time or offer to add them to the waitlist (call \`join_waitlist\`) so they're contacted first if it frees up.`,
            },
          ],
        };
      }

      const appointment = await ctx.appointments.book({
        businessId: ctx.businessId,
        conversationId: ctx.conversationId,
        customerContactId: ctx.customerContactId,
        title: args.title,
        startAt,
        endAt,
        customerName: args.customerName ?? null,
        phone: args.phone ?? null,
        notes: args.notes ?? null,
        source: 'agent',
      });

      return {
        content: [
          {
            type: 'text',
            text: `Appointment booked (id=${appointment.id}) for ${formatIsraelTime(startAt)}. Confirm it warmly to the customer in their language, restating the day and time so there's no confusion.`,
          },
        ],
      };
    },
  );
}

export function findFreeSlotsTool(ctx: ToolContext) {
  return tool(
    'find_free_slots',
    "Offer the customer concrete open appointment times. Call this when the customer is flexible, unsure, or asks when you're available — instead of guessing a time. It returns real open slots that fit the business's opening hours, buffer, and existing bookings. Then offer 2–3 of them to the customer in their language and book the one they pick with schedule_appointment.",
    {
      durationMinutes: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Length of the appointment in minutes. Defaults to 60.'),
      daysAhead: z
        .number()
        .int()
        .positive()
        .max(60)
        .optional()
        .describe('How many days ahead to search. Defaults to 14.'),
    },
    async (args) => {
      const duration = args.durationMinutes ?? 60;
      const from = new Date();
      const to = new Date(
        from.getTime() + (args.daysAhead ?? 14) * 24 * 60 * 60 * 1000,
      );
      const { slots, hoursConfigured } = await ctx.appointments.freeSlots(
        ctx.businessId,
        from,
        to,
        duration,
        6,
      );
      if (!hoursConfigured) {
        return {
          content: [
            {
              type: 'text',
              text: "The business hasn't set opening hours, so I can't list specific open slots. Ask the customer which day and time suits them, then book that with schedule_appointment (it's still checked for conflicts).",
            },
          ],
        };
      }
      if (slots.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No open slots in that window. Let the customer know nothing is free soon and offer to add them to the waitlist (join_waitlist), or ask them to suggest another period.',
            },
          ],
        };
      }
      const list = slots
        .map((s) => `• ${formatIsraelTime(new Date(s.start))}`)
        .join('\n');
      return {
        content: [
          {
            type: 'text',
            text: `Open slots (offer the customer 2–3 of these in their language, then book their choice with schedule_appointment):\n${list}`,
          },
        ],
      };
    },
  );
}

export function cancelAppointmentTool(ctx: ToolContext) {
  return tool(
    'cancel_appointment',
    "Cancel one of THIS customer's existing appointments. ALWAYS confirm with the customer which appointment (state the day and time back to them) and get their explicit yes before calling this — even though you can see their appointments, never cancel one they didn't clearly ask to cancel. Cancelling frees the slot and offers it to the next person on the waitlist automatically.",
    {
      appointmentId: z
        .string()
        .describe(
          'The id of the appointment to cancel, taken from the appointments list you were given for this customer.',
        ),
    },
    async (args) => {
      try {
        const cancelled = await ctx.appointments.cancelForContact(
          ctx.businessId,
          ctx.customerContactId,
          args.appointmentId,
        );
        return {
          content: [
            {
              type: 'text',
              text: `Appointment "${cancelled.title}" (${formatIsraelTime(cancelled.startAt)}) is cancelled. Confirm the cancellation warmly to the customer in their language.`,
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: 'text',
              text: "Couldn't cancel that appointment (it may not exist or isn't this customer's). Ask the customer to confirm which appointment they mean, or offer to pass them to a human.",
            },
          ],
        };
      }
    },
  );
}

export function rescheduleAppointmentTool(ctx: ToolContext) {
  return tool(
    'reschedule_appointment',
    "Move one of THIS customer's appointments to a new time. Confirm both the appointment and the new time with the customer before calling. The old slot is freed to the waitlist and the new time is booked.",
    {
      appointmentId: z
        .string()
        .describe(
          'The id of the appointment to move (from the list you were given).',
        ),
      newStart: z
        .string()
        .describe(
          'The new start in Israel local time, ISO without timezone (e.g. "2026-07-28T16:00").',
        ),
      durationMinutes: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('New length in minutes. Defaults to 60.'),
    },
    async (args) => {
      const newStart = parseIsraelDate(args.newStart);
      if (!newStart) {
        return {
          content: [
            {
              type: 'text',
              text: 'The new time could not be understood. Ask the customer to restate the day and time.',
            },
          ],
        };
      }
      const end = new Date(
        newStart.getTime() + (args.durationMinutes ?? 60) * 60 * 1000,
      );
      try {
        const moved = await ctx.appointments.rescheduleForContact(
          ctx.businessId,
          ctx.customerContactId,
          args.appointmentId,
          newStart,
          end,
        );
        return {
          content: [
            {
              type: 'text',
              text: `Moved to ${formatIsraelTime(moved.startAt)}. Confirm the new day and time to the customer in their language.`,
            },
          ],
        };
      } catch (err) {
        const message = (err as Error).message ?? '';
        const taken = message.includes('SLOT_TAKEN');
        const closed = message.includes('OUTSIDE_HOURS');
        return {
          content: [
            {
              type: 'text',
              text: taken
                ? `The new time (${formatIsraelTime(newStart)}) is already taken. Offer the customer a different time.`
                : closed
                  ? `The new time (${formatIsraelTime(newStart)}) is outside the business's working hours. Offer the customer a time within opening hours instead.`
                  : "Couldn't move that appointment. Ask the customer to confirm which appointment and time, or offer a human.",
            },
          ],
        };
      }
    },
  );
}

export function joinWaitlistTool(ctx: ToolContext) {
  return tool(
    'join_waitlist',
    "Add the customer to the waitlist when the time they want is taken (or they're flexible and want to be told when something opens). If an appointment is later cancelled, the first matching person on the waitlist is offered the freed slot automatically. Confirm the customer wants this before calling.",
    {
      service: z
        .string()
        .describe('What the customer wants an appointment for, e.g. "תספורת".'),
      customerName: z
        .string()
        .optional()
        .describe("The customer's name, if known."),
      phone: z
        .string()
        .optional()
        .describe(
          'Customer phone including country code — needed so we can offer them a freed slot.',
        ),
      preferredFrom: z
        .string()
        .optional()
        .describe(
          'Earliest acceptable time, Israel local ISO (e.g. "2026-07-28T09:00"). Omit if any time works.',
        ),
      preferredTo: z
        .string()
        .optional()
        .describe(
          'Latest acceptable time, Israel local ISO. Omit if any time works.',
        ),
      notes: z.string().optional().describe('Any extra detail.'),
    },
    async (args) => {
      const entry = await ctx.waitlist.join({
        businessId: ctx.businessId,
        conversationId: ctx.conversationId,
        customerContactId: ctx.customerContactId,
        service: args.service,
        customerName: args.customerName ?? null,
        phone: args.phone ?? null,
        preferredFrom: args.preferredFrom
          ? parseIsraelDate(args.preferredFrom)
          : null,
        preferredTo: args.preferredTo
          ? parseIsraelDate(args.preferredTo)
          : null,
        notes: args.notes ?? null,
      });
      return {
        content: [
          {
            type: 'text',
            text: `Added to the waitlist (id=${entry.id}). Reassure the customer warmly in their language that you'll message them the moment a matching slot opens.`,
          },
        ],
      };
    },
  );
}

export function escalateToHumanTool(ctx: ToolContext) {
  return tool(
    'escalate_to_human',
    'Hand the conversation over to a human team member. Use when the customer asks for a human, complains, the issue is sensitive, or you cannot help confidently. After calling this, you (the AI agent) will stop responding until a human takes over.',
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

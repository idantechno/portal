import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { ConversationsService } from '../conversations/conversations.service';
import { LeadsService } from '../leads/leads.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { WaitlistService } from '../appointments/waitlist.service';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
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
  /** Channel the conversation arrived on — recorded as the lead's origin. */
  channel?: Channel;
  leads: LeadsService;
  conversations: ConversationsService;
  appointments: AppointmentsService;
  waitlist: WaitlistService;
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
        const taken = (err as Error).message?.includes('SLOT_TAKEN');
        return {
          content: [
            {
              type: 'text',
              text: taken
                ? `The new time (${formatIsraelTime(newStart)}) is already taken. Offer the customer a different time.`
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

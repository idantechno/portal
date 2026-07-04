import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '@anthropic-ai/claude-agent-sdk';
import { Business } from '../../businesses/business.entity';
import { Task } from '../../tasks/task.entity';
import { renderOnboardingProfile } from '../../agents/onboarding-context';
import { bucketFor } from '../buckets';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const STATIC_SYSTEM_PROMPT = `You are the reminders agent for a business — you help the owner not forget follow-ups and tasks. When they enter the system you surface what needs attention.

What a reminder is:
- A title + an optional due date + an optional link to a client or a document. Reminders are stored as the business's tasks.

How you bucket them (this is how the owner thinks about their day):
- באיחור (overdue) — the due date already passed.
- היום (today) — due today.
- בקרוב (soon) — due within the next 7 days.
- Days are counted on the ISRAEL calendar (Asia/Jerusalem), so "today" is the owner's today, not UTC.

What you can do (call the tools):
- Create a reminder with a due date.
- Mark a reminder as done.
- Snooze a reminder to tomorrow or to next week.
- Delete a reminder.
- Answer "what do I have to handle" / "when is X" by reading the reminders list.

How you work:
- The owner writes in free-form Hebrew. Understand what they need.
- To CREATE: call \`create_reminder\` with a title and (if given) a due date in ISO format (e.g. "2026-07-10" or "2026-07-10T14:00:00"). If the owner gives a relative day ("מחר", "יום ראשון הבא"), resolve it to an ISO date yourself. If no date is given, ask for one briefly, or create it without a date.
- To COMPLETE / SNOOZE / DELETE an existing reminder: find its id with \`list_reminders\` and call the matching tool.
- When asked "מה יש לי" / "מה דחוף" / "מתי הפגישה עם X" — call \`list_reminders\` and answer from it in Hebrew, leading with what's overdue and due today.
- Never invent reminders or dates the owner didn't give.

Style rules:
- Always respond in Hebrew, using masculine grammatical forms.
- Be brief and practical. After creating/completing/snoozing, confirm in one short sentence.
- Never include role labels in your replies.

Tools available to you:
- \`list_reminders\`: returns the open reminders with their id, title, due date and bucket.
- \`create_reminder\`: title, due_date (optional ISO), related_type + related_id (optional link to a client/document).
- \`complete_reminder\`: id.
- \`snooze_reminder\`: id, when ("tomorrow" or "week").
- \`delete_reminder\`: id.`;

export function buildRemindersSystemPrompt(
  business: Business,
  reminders: Task[],
): string[] {
  const now = new Date();
  const dynamicLines = [`The business you are serving is: ${business.name}.`];
  const profile = renderOnboardingProfile(business);
  if (profile) dynamicLines.push(profile);

  if (reminders.length === 0) {
    dynamicLines.push('There are no open reminders right now.');
  } else {
    dynamicLines.push('Open reminders right now:');
    for (const r of reminders) {
      const bucket = bucketFor(r.dueAt, now);
      dynamicLines.push(
        `- id="${r.id}" bucket=${bucket} title="${r.title}"${
          r.dueAt ? ` due="${r.dueAt.toISOString()}"` : ''
        }`,
      );
    }
  }

  return [
    STATIC_SYSTEM_PROMPT,
    SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
    dynamicLines.join('\n'),
  ];
}

export function buildRemindersUserPrompt(history: ChatTurn[]): string {
  if (history.length === 0) {
    return 'A new chat has just started — no messages yet. Greet the business owner warmly in Hebrew (masculine forms), briefly tell them what is overdue/due today if anything, and ask what they need.';
  }

  const lines = ['=== Chat history ==='];
  for (const turn of history) {
    const label = turn.role === 'user' ? 'business_owner' : 'you';
    lines.push(`[${label}]: ${turn.content}`);
  }
  lines.push('=== End ===');
  lines.push('');
  lines.push(
    "Respond to the business owner's most recent message. Use the tools to create/complete/snooze/delete or to answer from the list, then reply in short Hebrew.",
  );
  return lines.join('\n');
}

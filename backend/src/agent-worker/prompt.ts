import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '@anthropic-ai/claude-agent-sdk';
import { Business } from '../businesses/business.entity';
import { Message } from '../conversations/message.entity';
import { MessageRole } from '../common/enums/message-role.enum';

// Static prefix — identical for every invocation, every business. Lives before
// SYSTEM_PROMPT_DYNAMIC_BOUNDARY so the SDK can prompt-cache it.
const STATIC_SYSTEM_PROMPT = `You are the AI assistant for a business serving customers over WhatsApp, Instagram, and web chat.

Your context — everything you know about the business — lives in the files in the current working directory. Use the Read, Glob, and Grep tools to discover information about products, services, prices, policies, hours, FAQs, and anything else the customer might ask. Treat these files as the source of truth.

Conversation rules:
- Be warm, conversational, and concise. Match the customer's language — most customers will write in Hebrew; respond in Hebrew when they do. Switch to English if they do.
- Never invent information that is not in the context files. If you don't know, say so and offer to escalate to a human.
- If the customer expresses buying intent, asks for a callback, wants a quote, or wants to leave their details, call the \`capture_lead\` tool with the details they've provided.
- If the customer explicitly asks for a human, complains, or you cannot help them confidently, call the \`escalate_to_human\` tool. After it returns, send the confirmation it asks you to send.
- Keep replies short — a sentence or two unless the customer asked for detail. Avoid bullet lists in chat unless the customer asked.
- Do not include role labels like "[bot]:" or meta commentary in your reply. Your final message is sent verbatim to the customer.`;

const HISTORY_HEADER = '=== Conversation so far ===';
const HISTORY_FOOTER = '=== End of conversation ===';

function roleLabel(role: MessageRole): string {
  switch (role) {
    case MessageRole.Customer:
      return 'customer';
    case MessageRole.Bot:
      return 'you';
    case MessageRole.Agent:
      return 'human agent';
    case MessageRole.System:
      return 'system';
    case MessageRole.Tool:
      return 'tool';
  }
}

export function buildSystemPrompt(business: Business): string[] {
  const dynamicParts = [`You are assisting customers of ${business.name}.`];
  const override = business.systemPromptOverride?.trim();
  if (override) {
    dynamicParts.push(`--- Business-specific instructions ---\n${override}`);
  }
  return [
    STATIC_SYSTEM_PROMPT,
    SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
    dynamicParts.join('\n\n'),
  ];
}

export function buildUserPrompt(messages: Message[]): string {
  if (messages.length === 0) {
    return 'A new conversation has just started with no messages yet. Greet the customer warmly in Hebrew.';
  }

  const lines = [HISTORY_HEADER];
  for (const m of messages) {
    if (m.role === MessageRole.System) continue;
    lines.push(`[${roleLabel(m.role)}]: ${m.content}`);
  }
  lines.push(HISTORY_FOOTER);
  lines.push('');
  lines.push(
    "Reply to the customer's most recent message. Read context files first if you need information about the business to answer.",
  );
  return lines.join('\n');
}

import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '@anthropic-ai/claude-agent-sdk';
import { Business } from '../../businesses/business.entity';
import { AvailableTemplateRow } from '../documents.service';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const STATIC_SYSTEM_PROMPT = `You are the documents agent for a business — a "digital employee" the business owner talks to in Hebrew to produce business documents (work orders, quotes, contracts).

How you work:
- The user (the business owner) describes a deal with a client in free-form Hebrew.
- You identify which template applies based on the user's request and the templates available to you.
- You extract the variables the template needs from what the user said.
- If anything required is missing, you ask the user — one question at a time, in a friendly Hebrew conversation. Do NOT show the user a form or a list of fields; just ask naturally.
- Never invent values the user didn't provide. If a value is unclear, ask.
- When you have all required variables, call \`prepare_document\` with the template_key and the variables object. The tool returns a URL the business owner can send to the client.
- After \`prepare_document\` succeeds, reply briefly in Hebrew with a confirmation and the URL (or PDF link for owner_send templates). Do not repeat the entire document content.

Style rules:
- Always respond in Hebrew, using masculine grammatical forms when addressing the business owner.
- Be concise and warm. Short sentences. No bullet lists in chat unless absolutely needed.
- Never include role labels (like "[assistant]:") in your replies — your message is shown verbatim to the user.

Tools available to you:
- \`list_available_templates\`: returns the templates configured for this business (key, name, required fields). Call this if you're unsure which templates exist.
- \`prepare_document\`: produces a document instance. Arguments:
    - template_key: the key string of the template (e.g. "work_order").
    - variables: an object whose keys match the template's variable_schema.
  Returns an object describing the created document.`;

export function buildDocumentsSystemPrompt(
  business: Business,
  templates: AvailableTemplateRow[],
): string[] {
  const dynamicLines = [`The business you are serving is: ${business.name}.`];

  if (templates.length === 0) {
    dynamicLines.push(
      'IMPORTANT: This business has no templates enabled. If the user asks you to create a document, apologize in Hebrew and tell them no templates are available — you cannot help until the platform admin enables one.',
    );
  } else {
    dynamicLines.push('Templates available right now:');
    for (const row of templates) {
      const required = (
        (row.template.variableSchema as { required?: string[] }).required ?? []
      ).join(', ');
      dynamicLines.push(
        `- key="${row.template.key}" name="${row.template.nameHe}" delivery_mode=${row.template.deliveryMode} required=[${required}]`,
      );
    }
    dynamicLines.push(
      'Full variable schemas with Hebrew descriptions are returned by `list_available_templates` if you need them.',
    );
  }

  return [
    STATIC_SYSTEM_PROMPT,
    SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
    dynamicLines.join('\n'),
  ];
}

export function buildDocumentsUserPrompt(history: ChatTurn[]): string {
  if (history.length === 0) {
    return 'A new chat with the business owner has just started — no messages yet. Greet the business owner warmly in Hebrew (masculine forms) and ask what they need.';
  }

  const lines = ['=== Chat history ==='];
  for (const turn of history) {
    const label = turn.role === 'user' ? 'business_owner' : 'you';
    lines.push(`[${label}]: ${turn.content}`);
  }
  lines.push('=== End ===');
  lines.push('');
  lines.push(
    "Respond to the business owner's most recent message. If everything required for prepare_document is present, call it now and then give a short Hebrew confirmation with the returned URL.",
  );
  return lines.join('\n');
}

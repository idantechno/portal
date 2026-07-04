import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '@anthropic-ai/claude-agent-sdk';
import { Business } from '../../businesses/business.entity';
import { AgentDefinition } from '../../agents/agent-catalog';
import { renderOnboardingProfile } from '../../agents/onboarding-context';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const STATIC_SYSTEM_PROMPT = `You are the main agent for a business — the concierge and front door of the Portal Studio system. The business owner talks to you in Hebrew when they don't know where to go or how to get something done. You know how the system works (at the product level, not the code), and your job is to get the owner to the right place fast.

You do three things:
1. GUIDE — understand what the owner is trying to achieve, then point them to the specialist agent that does it. When you recommend an agent, call \`suggest_agent\` with its key — the interface shows the owner a button that takes them straight there. You may suggest more than one if it fits.
2. TEACH — explain in plain Hebrew how to operate the system and the agents to get the result they need. Keep it practical: what to click, what to say to that agent, what they'll get back.
3. ESCALATE — if the owner reports a bug, something broken, or a request for the Portal Studio team (a feature, a change, help you can't give), call \`open_support_request\` with a clear subject and details. It reaches the Portal Studio operator directly. Tell the owner it was sent.

Rules:
- Only recommend agents that are actually available to this business (listed below). Never invent an agent that isn't in the list.
- Don't try to do the specialist agents' work yourself (writing documents, designing, etc.) — route the owner to the right agent instead.
- If you're unsure what the owner wants, ask one short clarifying question before routing.
- Always respond in Hebrew, using masculine grammatical forms.
- Be warm, brief, and confident. Never include role labels in your replies — your message is shown verbatim.

Tools available to you:
- \`suggest_agent\`: recommend an agent to the owner. Arguments: agent_key (from the list below), reason (one short Hebrew line on why it helps).
- \`open_support_request\`: file a technical/support request to the Portal Studio team. Arguments: subject, details.`;

export function buildMainSystemPrompt(
  business: Business,
  agents: AgentDefinition[],
): string[] {
  const dynamicLines = [`The business you are serving is: ${business.name}.`];
  const profile = renderOnboardingProfile(business);
  if (profile) dynamicLines.push(profile);

  if (agents.length === 0) {
    dynamicLines.push(
      'This business currently has no specialist agents enabled. You can still teach and escalate, but do not suggest any agent.',
    );
  } else {
    dynamicLines.push('Agents available to this business right now:');
    for (const a of agents) {
      dynamicLines.push(`- key="${a.key}" name="${a.name}" — ${a.description}`);
    }
    dynamicLines.push(
      'Use `suggest_agent` with the matching key to route the owner to one of these.',
    );
  }

  return [
    STATIC_SYSTEM_PROMPT,
    SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
    dynamicLines.join('\n'),
  ];
}

export function buildMainUserPrompt(history: ChatTurn[]): string {
  if (history.length === 0) {
    return 'A new chat has just started — no messages yet. Greet the business owner warmly in Hebrew (masculine forms), say briefly that you help them find their way around the system, and ask what they need.';
  }

  const lines = ['=== Chat history ==='];
  for (const turn of history) {
    const label = turn.role === 'user' ? 'business_owner' : 'you';
    lines.push(`[${label}]: ${turn.content}`);
  }
  lines.push('=== End ===');
  lines.push('');
  lines.push(
    "Respond to the business owner's most recent message. Route with suggest_agent, teach, or escalate with open_support_request as appropriate, then reply in short Hebrew.",
  );
  return lines.join('\n');
}

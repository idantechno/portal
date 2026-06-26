/**
 * Code-defined catalog of agent "products" the platform offers. Adding a new
 * agent = adding an entry here + building its module + gating its routes with
 * @RequireAgent(key). Per-business access is granted in the business_agents
 * table by an admin; this file is just the source-of-truth list of what exists.
 */
export const AGENT_KEYS = ['chat', 'documents'] as const;

export type AgentKey = (typeof AGENT_KEYS)[number];

export interface AgentDefinition {
  key: AgentKey;
  name: string;
  description: string;
  icon: string;
  /** Seeded value when a business is created — still revocable by an admin. */
  defaultEnabled: boolean;
}

export const AGENT_CATALOG: readonly AgentDefinition[] = [
  {
    key: 'chat',
    name: 'סוכן צ׳אט',
    description: 'מענה אוטומטי ללקוחות ב-WhatsApp ובווידג׳ט האתר.',
    icon: '💬',
    defaultEnabled: true,
  },
  {
    key: 'documents',
    name: 'סוכן מסמכים',
    description: 'הפקת הצעות מחיר, חוזים והזמנות עבודה לחתימה.',
    icon: '📝',
    defaultEnabled: false,
  },
];

export function isAgentKey(key: string): key is AgentKey {
  return (AGENT_KEYS as readonly string[]).includes(key);
}

export function getAgentDefinition(key: string): AgentDefinition | undefined {
  return AGENT_CATALOG.find((a) => a.key === key);
}

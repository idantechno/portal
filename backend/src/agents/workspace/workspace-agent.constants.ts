/**
 * Agents served by the generic workspace framework — the ones without a
 * bespoke module of their own. Each gets a domain-focused chat + at least one
 * structured tool, driven by the config registry (workspace-agent.configs.ts).
 * The mature agents (main, reminders, documents, designer, ideas) keep their
 * own modules and are NOT listed here.
 */
export const WORKSPACE_AGENT_KEYS = [
  'marketing',
  'analytics',
  'sales',
  'crm',
  'quote',
  'accounting',
  'orchestrator',
] as const;

export type WorkspaceAgentKey = (typeof WORKSPACE_AGENT_KEYS)[number];

export function isWorkspaceAgentKey(key: string): key is WorkspaceAgentKey {
  return (WORKSPACE_AGENT_KEYS as readonly string[]).includes(key);
}

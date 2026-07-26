/**
 * Capabilities are the bridge between a paid PLAN and what the code actually
 * lets a business do. Until now the plan `features` strings were display-only
 * marketing and nothing enforced them — e.g. the chat agent could book
 * appointments on every tier even though booking is sold only on the top plan.
 *
 * This file is the single source of truth for "which plan unlocks what". Every
 * gate in the codebase (agent-worker tools, Google integration, the manual
 * calendar) resolves a business's plan to this capability set and checks it,
 * instead of trusting the marketing copy.
 */
export type PlanCapability =
  /** Chat agent may auto-reply to customers (answer & inform only). */
  | 'chat'
  /** CRM / customer records. */
  | 'crm'
  /** Owner-managed calendar + tasks (the OWNER enters events by hand). */
  | 'calendar_manual'
  /** Documents / marketing / analytics agents + automations. */
  | 'pro_agents'
  /** Google integration (Gmail + Calendar sync). Top tier only. */
  | 'google'
  /**
   * The agent itself may schedule / cancel / reschedule appointments and manage
   * the waitlist from a conversation. Top tier only — this is the capability
   * whose absence keeps a lower-tier chat agent from ever booking a meeting.
   */
  | 'agent_scheduling'
  /** The full agent team, including the reminders agent. Top tier only. */
  | 'all_agents'
  /** Priority support. */
  | 'priority_support';

/**
 * Plan code → capabilities it unlocks. Keys must match `PLAN_CATALOG` codes in
 * `billing-plans.ts`. Higher tiers are supersets of lower ones.
 */
export const PLAN_CAPABILITIES: Record<string, readonly PlanCapability[]> = {
  basic: ['chat', 'crm'],
  growth: ['chat', 'crm', 'calendar_manual', 'pro_agents'],
  exclusive: [
    'chat',
    'crm',
    'calendar_manual',
    'pro_agents',
    'google',
    'agent_scheduling',
    'all_agents',
    'priority_support',
  ],
};

/** Capabilities for a plan code, or an empty list for an unknown plan. */
export function planCapabilities(code: string): readonly PlanCapability[] {
  return PLAN_CAPABILITIES[code] ?? [];
}

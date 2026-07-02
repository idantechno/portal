/**
 * The event keys an automation rule can trigger on. Emitted from the place that
 * creates the underlying domain object (a lead, an inbound message, a signed
 * document). Adding a trigger = add a key here + call `automations.emit()` at
 * the source.
 */
export const AUTOMATION_TRIGGERS = [
  'lead.created',
  'message.received',
  'document.signed',
  'task.created',
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

/** What a rule can do when it fires. */
export const AUTOMATION_ACTION_TYPES = [
  'create_task',
  'notify',
  'run_agent',
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export interface AutomationAction {
  type: AutomationActionType;
  /** Action-specific params, e.g. { title } for create_task, { agentKey }. */
  params: Record<string, unknown>;
}

/** A single equality condition evaluated against the event payload. */
export interface AutomationCondition {
  field: string;
  equals: unknown;
}

export function isAutomationTrigger(v: string): v is AutomationTrigger {
  return (AUTOMATION_TRIGGERS as readonly string[]).includes(v);
}

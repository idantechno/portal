/**
 * Per-contact agent behaviour, set by the operator on the contact card.
 *  - `active`  — the agent answers this contact immediately (the default).
 *  - `off`     — the agent never answers this contact; the owner handles it.
 *  - `delayed` — "owner first": when the contact messages, the agent waits a
 *                configured window (see `agentDelayMinutes`) to let the owner
 *                reply. If the owner hasn't replied by then, the agent steps in
 *                with a gentle "the owner isn't free right now" message.
 */
export enum ContactAgentMode {
  Active = 'active',
  Off = 'off',
  Delayed = 'delayed',
}

/**
 * Allowed wait windows (minutes) for `delayed` mode — the exact set the UI
 * offers. Anything outside this list is rejected at the DTO. Kept here so the
 * backend validation and the delay math share one source of truth.
 */
export const CONTACT_AGENT_DELAY_CHOICES = [
  2, 3, 5, 10, 15, 30, 45, 60, 120, 180, 300,
] as const;

/** Fallback window when a contact is switched to `delayed` without a value. */
export const DEFAULT_CONTACT_AGENT_DELAY_MINUTES = 10;

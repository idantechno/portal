export const AGENT_RUNS_QUEUE = 'agent-runs';

export interface AgentRunJobData {
  conversationId: string;
  businessId: string;
  latestMessageId: string;
  /**
   * Set on the DELAYED "owner-first" path: the job was scheduled to fire after
   * the owner's wait window. When it runs, the worker first checks the owner
   * hasn't answered in the meantime, then produces the gentle "owner isn't free
   * right now" step-in message instead of a normal reply.
   */
  stepIn?: boolean;
}

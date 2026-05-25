export const AGENT_RUNS_QUEUE = 'agent-runs';

export interface AgentRunJobData {
  conversationId: string;
  businessId: string;
  latestMessageId: string;
}

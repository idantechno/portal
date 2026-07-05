import { api } from "./client";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AgentSuggestion {
  key: string;
  name: string;
  reason: string;
}

export interface WorkspaceChatResult {
  reply: string;
  changed: boolean;
  suggestions: AgentSuggestion[];
}

export const workspaceAgentsApi = {
  /** Uniform chat endpoint for the generic (workspace) agents. */
  chat: (businessId: string, agentKey: string, history: ChatTurn[]) =>
    api
      .post<WorkspaceChatResult>(
        `/businesses/${businessId}/workspace/${agentKey}/chat`,
        { history },
      )
      .then((r) => r.data),
};

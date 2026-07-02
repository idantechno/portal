import { api } from "./client";
import type { AgentDefinition } from "./types";

export interface RunAgentResult {
  agentKey: string;
  agentName: string;
  text: string;
}

export const agentsApi = {
  /** Agents the current user is entitled to across their businesses. */
  mine: () => api.get<AgentDefinition[]>("/me/agents").then((r) => r.data),
  /** Run an entitled agent on-demand and get its generated artifact. */
  run: (businessId: string, agentKey: string, instruction: string) =>
    api
      .post<RunAgentResult>(
        `/businesses/${businessId}/agents/${agentKey}/run`,
        { instruction },
      )
      .then((r) => r.data),
};

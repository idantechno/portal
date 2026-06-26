import { api } from "./client";
import type { AgentDefinition } from "./types";

export const agentsApi = {
  /** Agents the current user is entitled to across their businesses. */
  mine: () => api.get<AgentDefinition[]>("/me/agents").then((r) => r.data),
};

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

export interface MainChatResult {
  reply: string;
  suggestions: AgentSuggestion[];
  ticketCreated: boolean;
}

export const mainApi = {
  chat: (businessId: string, history: ChatTurn[]) =>
    api
      .post<MainChatResult>(`/businesses/${businessId}/agents/main/chat`, {
        history,
      })
      .then((r) => r.data),
};

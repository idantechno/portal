import { api } from "./client";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type IdeaStatus = "seed" | "shaping" | "developed";

export interface Idea {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  status: IdeaStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IdeasChatResult {
  reply: string;
  saved: Idea[];
}

export const ideasApi = {
  chat: (businessId: string, history: ChatTurn[]) =>
    api
      .post<IdeasChatResult>(`/businesses/${businessId}/agents/ideas/chat`, {
        history,
      })
      .then((r) => r.data),

  list: (businessId: string) =>
    api.get<Idea[]>(`/businesses/${businessId}/ideas`).then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: boolean }>(`/businesses/${businessId}/ideas/${id}`)
      .then((r) => r.data),
};

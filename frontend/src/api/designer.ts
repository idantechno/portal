import { api } from "./client";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type DesignKind =
  | "menu"
  | "poster"
  | "invitation"
  | "pricelist"
  | "flyer"
  | "other";

export interface DesignProduct {
  id: string;
  kind: DesignKind;
  title: string;
  contentSummary: string | null;
  primaryColor: string | null;
  createdAt: string;
}

export interface DesignerChatResult {
  reply: string;
  created: DesignProduct[];
}

export const designerApi = {
  chat: (businessId: string, history: ChatTurn[]) =>
    api
      .post<DesignerChatResult>(
        `/businesses/${businessId}/agents/designer/chat`,
        { history },
      )
      .then((r) => r.data),

  list: (businessId: string) =>
    api
      .get<DesignProduct[]>(`/businesses/${businessId}/designs`)
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: boolean }>(`/businesses/${businessId}/designs/${id}`)
      .then((r) => r.data),

  pdfUrl: (businessId: string, id: string) =>
    `/api/businesses/${businessId}/designs/${id}/pdf`,
};

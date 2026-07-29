import { api } from "./client";

export type AiUpdateScope = "business" | "internal";

export interface AiUpdateItem {
  headline: string;
  detail: string;
}

export interface AiUpdateSource {
  title: string;
  url: string;
}

export interface AiUpdate {
  id: string;
  scope: AiUpdateScope;
  title: string;
  /** Markdown-ish body; rendered as plain text with preserved line breaks. */
  summary: string;
  items: AiUpdateItem[];
  sources: AiUpdateSource[];
  createdAt: string;
}

export const aiUpdatesApi = {
  /** The business-facing daily feed (entitled businesses only). */
  list: (businessId: string) =>
    api
      .get<AiUpdate[]>(`/businesses/${businessId}/ai-updates`)
      .then((r) => r.data),
  /** The weekly Anthropic/Claude feed — operator (super-admin) only. */
  internal: () =>
    api.get<AiUpdate[]>(`/ai-updates/internal`).then((r) => r.data),
  /** On-demand generation — operator only. */
  generate: (scope: AiUpdateScope) =>
    api
      .post<AiUpdate | null>(`/ai-updates/generate`, { scope })
      .then((r) => r.data),
};

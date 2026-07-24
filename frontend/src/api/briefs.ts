import { api } from "./client";

export type BriefStatus = "draft" | "approved";

export interface Brief {
  id: string;
  businessId: string;
  leadId: string | null;
  title: string;
  /** Absent in list responses — fetched with the single brief. */
  markdown?: string;
  status: BriefStatus;
  websiteUrl: string | null;
  model: string | null;
  edited: boolean;
  payload?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateBriefInput {
  websiteUrl?: string;
  /** 🔵 only — skips the model call. */
  skipDrafting?: boolean;
}

export const briefsApi = {
  list: (businessId: string) =>
    api.get<Brief[]>(`/businesses/${businessId}/briefs`).then((r) => r.data),

  get: (businessId: string, id: string) =>
    api
      .get<Brief>(`/businesses/${businessId}/briefs/${id}`)
      .then((r) => r.data),

  generate: (businessId: string, leadId: string, input: GenerateBriefInput) =>
    api
      .post<Brief>(`/businesses/${businessId}/leads/${leadId}/brief`, input)
      .then((r) => r.data),

  update: (
    businessId: string,
    id: string,
    patch: { markdown?: string; status?: BriefStatus; title?: string },
  ) =>
    api
      .patch<Brief>(`/businesses/${businessId}/briefs/${id}`, patch)
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: true }>(`/businesses/${businessId}/briefs/${id}`)
      .then((r) => r.data),
};

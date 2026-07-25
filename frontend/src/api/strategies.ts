import { api } from "./client";

export type StrategyStatus = "draft" | "approved";

export interface Strategy {
  id: string;
  businessId: string;
  briefId: string | null;
  title: string;
  /** Absent in list responses — fetched with the single strategy. */
  markdown?: string;
  status: StrategyStatus;
  model: string | null;
  edited: boolean;
  payload?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateStrategyInput {
  /** Skip the model call — produces an empty ⟨לא ידוע⟩ shell. */
  skipDrafting?: boolean;
}

export const strategiesApi = {
  list: (businessId: string) =>
    api
      .get<Strategy[]>(`/businesses/${businessId}/strategies`)
      .then((r) => r.data),

  get: (businessId: string, id: string) =>
    api
      .get<Strategy>(`/businesses/${businessId}/strategies/${id}`)
      .then((r) => r.data),

  /** Clean, client-facing markdown (internal notes stripped). */
  clientMarkdown: (businessId: string, id: string) =>
    api
      .get<{ markdown: string }>(
        `/businesses/${businessId}/strategies/${id}/client`,
      )
      .then((r) => r.data.markdown),

  /** The client-facing version as a branded PDF (binary blob). */
  clientPdf: (businessId: string, id: string) =>
    api
      .get(`/businesses/${businessId}/strategies/${id}/client.pdf`, {
        responseType: "blob",
      })
      .then((r) => r.data as Blob),

  generate: (
    businessId: string,
    briefId: string,
    input: GenerateStrategyInput = {},
  ) =>
    api
      .post<Strategy>(
        `/businesses/${businessId}/briefs/${briefId}/strategy`,
        input,
      )
      .then((r) => r.data),

  update: (
    businessId: string,
    id: string,
    patch: { markdown?: string; status?: StrategyStatus; title?: string },
  ) =>
    api
      .patch<Strategy>(`/businesses/${businessId}/strategies/${id}`, patch)
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: true }>(`/businesses/${businessId}/strategies/${id}`)
      .then((r) => r.data),
};

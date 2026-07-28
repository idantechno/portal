import { api } from "./client";

export type ObjectiveStatus = "draft" | "approved";

export interface Objective {
  id: string;
  businessId: string;
  customerId: string | null;
  briefId: string | null;
  title: string;
  markdown?: string;
  status: ObjectiveStatus;
  model: string | null;
  edited: boolean;
  payload?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export const objectivesApi = {
  list: (businessId: string, customerId?: string) =>
    api
      .get<Objective[]>(`/businesses/${businessId}/objectives`, {
        params: customerId ? { customerId } : undefined,
      })
      .then((r) => r.data),

  get: (businessId: string, id: string) =>
    api
      .get<Objective>(`/businesses/${businessId}/objectives/${id}`)
      .then((r) => r.data),

  generate: (businessId: string, customerId: string) =>
    api
      .post<Objective>(
        `/businesses/${businessId}/customers/${customerId}/objectives`,
        {},
      )
      .then((r) => r.data),

  update: (
    businessId: string,
    id: string,
    patch: { markdown?: string; status?: ObjectiveStatus; title?: string },
  ) =>
    api
      .patch<Objective>(`/businesses/${businessId}/objectives/${id}`, patch)
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: true }>(`/businesses/${businessId}/objectives/${id}`)
      .then((r) => r.data),
};

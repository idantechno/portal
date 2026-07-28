import { api } from "./client";

export type PlanStatus = "draft" | "approved";

export interface Plan {
  id: string;
  businessId: string;
  strategyId: string | null;
  customerId: string | null;
  title: string;
  /** Absent in list responses — fetched with the single plan. */
  markdown?: string;
  status: PlanStatus;
  model: string | null;
  edited: boolean;
  payload?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratePlanInput {
  /** Skip the model call — produces an empty ⟨לא ידוע⟩ shell. */
  skipDrafting?: boolean;
}

export const plansApi = {
  list: (businessId: string, customerId?: string) =>
    api
      .get<Plan[]>(`/businesses/${businessId}/plans`, {
        params: customerId ? { customerId } : undefined,
      })
      .then((r) => r.data),

  get: (businessId: string, id: string) =>
    api.get<Plan>(`/businesses/${businessId}/plans/${id}`).then((r) => r.data),

  generate: (
    businessId: string,
    strategyId: string,
    input: GeneratePlanInput = {},
  ) =>
    api
      .post<Plan>(
        `/businesses/${businessId}/strategies/${strategyId}/plan`,
        input,
      )
      .then((r) => r.data),

  update: (
    businessId: string,
    id: string,
    patch: { markdown?: string; status?: PlanStatus; title?: string },
  ) =>
    api
      .patch<Plan>(`/businesses/${businessId}/plans/${id}`, patch)
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: true }>(`/businesses/${businessId}/plans/${id}`)
      .then((r) => r.data),
};

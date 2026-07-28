import { api } from "./client";

export type CampaignStatus = "building" | "active" | "done";
export type ScheduleHorizon = "monthly" | "half_year" | "yearly";

export interface Campaign {
  id: string;
  businessId: string;
  customerId: string;
  name: string;
  status: CampaignStatus;
  marketingPlanId: string | null;
  productionPlan: Record<string, unknown> | null;
  scheduleHorizon: ScheduleHorizon | null;
  schedule: Record<string, unknown> | null;
  launchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PrerequisiteKey =
  | "brand_page"
  | "logo"
  | "marketing_plan"
  | "quote"
  | "goals";

export interface PrerequisiteItem {
  key: PrerequisiteKey;
  label: string;
  met: boolean;
  available: boolean;
  hint: string;
}

export interface PrerequisiteReport {
  items: PrerequisiteItem[];
  allMet: boolean;
}

export const campaignsApi = {
  prerequisites: (businessId: string, customerId: string) =>
    api
      .get<PrerequisiteReport>(
        `/businesses/${businessId}/customers/${customerId}/campaign-prerequisites`,
      )
      .then((r) => r.data),

  list: (businessId: string, customerId?: string) =>
    api
      .get<Campaign[]>(`/businesses/${businessId}/campaigns`, {
        params: customerId ? { customerId } : undefined,
      })
      .then((r) => r.data),

  get: (businessId: string, id: string) =>
    api
      .get<Campaign>(`/businesses/${businessId}/campaigns/${id}`)
      .then((r) => r.data),

  create: (businessId: string, customerId: string, name: string) =>
    api
      .post<Campaign>(
        `/businesses/${businessId}/customers/${customerId}/campaigns`,
        { name },
      )
      .then((r) => r.data),

  update: (
    businessId: string,
    id: string,
    patch: { name?: string; status?: CampaignStatus },
  ) =>
    api
      .patch<Campaign>(`/businesses/${businessId}/campaigns/${id}`, patch)
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: true }>(`/businesses/${businessId}/campaigns/${id}`)
      .then((r) => r.data),
};

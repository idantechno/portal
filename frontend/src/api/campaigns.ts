import { api } from "./client";

export type CampaignStatus = "building" | "active" | "done";
export type ScheduleHorizon = "monthly" | "half_year" | "yearly";

export interface ProductionAnswers {
  style: string;
  firstScene: string;
  clientPresence: string;
}

export interface ProductionItem {
  kind: string;
  title: string;
  description: string;
  format: string;
  versions: string;
}

export interface ProductionPlanDraft {
  concept: string;
  items: ProductionItem[];
  notes: string[];
}

export interface ScheduleItem {
  id: string;
  title: string;
  kind: string;
  channel: string;
  /** ISO datetime. */
  at: string;
  funding: string;
}

export interface Campaign {
  id: string;
  businessId: string;
  customerId: string;
  name: string;
  status: CampaignStatus;
  marketingPlanId: string | null;
  productionAnswers: ProductionAnswers | null;
  productionPlan: { draft: ProductionPlanDraft; generatedAt?: string } | null;
  scheduleHorizon: ScheduleHorizon | null;
  schedule: ScheduleItem[] | null;
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

export interface CampaignStatusReport {
  active: boolean;
  launchedAt: string | null;
  schedule: {
    total: number;
    published: number;
    upcoming: number;
    percent: number;
    nextAt: string | null;
  };
  leads: { sinceLaunch: number };
  customers: { sinceLaunch: number; convertedSinceLaunch: number };
  conclusions: string[];
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

  status: (businessId: string, id: string) =>
    api
      .get<CampaignStatusReport>(
        `/businesses/${businessId}/campaigns/${id}/status`,
      )
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

  saveAnswers: (
    businessId: string,
    id: string,
    answers: Partial<ProductionAnswers>,
  ) =>
    api
      .patch<Campaign>(
        `/businesses/${businessId}/campaigns/${id}/production-answers`,
        answers,
      )
      .then((r) => r.data),

  generateProduction: (businessId: string, id: string) =>
    api
      .post<Campaign>(
        `/businesses/${businessId}/campaigns/${id}/production-plan`,
        {},
      )
      .then((r) => r.data),

  buildSchedule: (businessId: string, id: string, horizon: ScheduleHorizon) =>
    api
      .post<Campaign>(
        `/businesses/${businessId}/campaigns/${id}/schedule/build`,
        { horizon },
      )
      .then((r) => r.data),

  saveSchedule: (
    businessId: string,
    id: string,
    input: { horizon?: ScheduleHorizon; items: ScheduleItem[] },
  ) =>
    api
      .patch<Campaign>(
        `/businesses/${businessId}/campaigns/${id}/schedule`,
        input,
      )
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: true }>(`/businesses/${businessId}/campaigns/${id}`)
      .then((r) => r.data),
};

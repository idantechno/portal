import { api } from "./client";

export type AutomationActionType = "create_task" | "notify" | "run_agent";

export interface AutomationAction {
  type: AutomationActionType;
  params: Record<string, unknown>;
}

export interface AutomationCondition {
  field: string;
  equals: unknown;
}

export interface AutomationRule {
  id: string;
  businessId: string;
  name: string;
  enabled: boolean;
  trigger: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAutomationBody {
  name: string;
  enabled?: boolean;
  trigger: string;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
}

export interface AutomationCatalog {
  triggers: string[];
  actionTypes: AutomationActionType[];
}

export const automationsApi = {
  catalog: (businessId: string) =>
    api
      .get<AutomationCatalog>(`/businesses/${businessId}/automations/catalog`)
      .then((r) => r.data),
  list: (businessId: string) =>
    api
      .get<AutomationRule[]>(`/businesses/${businessId}/automations`)
      .then((r) => r.data),
  create: (businessId: string, body: UpsertAutomationBody) =>
    api
      .post<AutomationRule>(`/businesses/${businessId}/automations`, body)
      .then((r) => r.data),
  update: (businessId: string, id: string, body: UpsertAutomationBody) =>
    api
      .put<AutomationRule>(`/businesses/${businessId}/automations/${id}`, body)
      .then((r) => r.data),
  setEnabled: (businessId: string, id: string, enabled: boolean) =>
    api
      .patch<AutomationRule>(
        `/businesses/${businessId}/automations/${id}/enabled`,
        { enabled },
      )
      .then((r) => r.data),
  test: (businessId: string, id: string) =>
    api
      .post<{ ran: number }>(`/businesses/${businessId}/automations/${id}/test`)
      .then((r) => r.data),
  remove: (businessId: string, id: string) =>
    api
      .delete(`/businesses/${businessId}/automations/${id}`)
      .then((r) => r.data),
};

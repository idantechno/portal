import { api } from "./client";

export interface CrmConnectionView {
  type: "webhook";
  enabled: boolean;
  url: string;
  hasSecret: boolean;
  pushLeads: boolean;
  pushAppointments: boolean;
  updatedAt: string;
}

export interface UpsertCrmBody {
  url: string;
  /** Omit to keep the stored secret; "" clears it. */
  secret?: string;
  enabled?: boolean;
  pushLeads?: boolean;
  pushAppointments?: boolean;
}

export const crmApi = {
  view: (businessId: string) =>
    api
      .get<CrmConnectionView | null>(`/businesses/${businessId}/crm-connection`)
      .then((r) => r.data),
  upsert: (businessId: string, body: UpsertCrmBody) =>
    api
      .put<CrmConnectionView>(`/businesses/${businessId}/crm-connection`, body)
      .then((r) => r.data),
  remove: (businessId: string) =>
    api
      .delete(`/businesses/${businessId}/crm-connection`)
      .then((r) => r.data),
  test: (businessId: string) =>
    api
      .post(`/businesses/${businessId}/crm-connection/test`)
      .then((r) => r.data),
};

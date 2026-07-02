import { api } from "./client";

export type IntegrationProvider = "gmail" | "calendar" | "drive";

export interface IntegrationView {
  provider: IntegrationProvider;
  name: string;
  description: string;
  icon: string;
  status: "connected" | "disconnected" | "error";
  accountEmail: string | null;
  connectedAt: string | null;
  available: boolean;
}

export const integrationsApi = {
  list: (businessId: string) =>
    api
      .get<IntegrationView[]>(`/businesses/${businessId}/integrations`)
      .then((r) => r.data),
  authUrl: (businessId: string, provider: IntegrationProvider) =>
    api
      .get<{ url: string }>(
        `/businesses/${businessId}/integrations/${provider}/auth-url`,
      )
      .then((r) => r.data.url),
  disconnect: (businessId: string, provider: IntegrationProvider) =>
    api
      .post(`/businesses/${businessId}/integrations/${provider}/disconnect`)
      .then((r) => r.data),
  sendEmail: (
    businessId: string,
    body: { to: string; subject: string; body: string },
  ) =>
    api
      .post<{ ok: true; from: string }>(
        `/businesses/${businessId}/integrations/gmail/send`,
        body,
      )
      .then((r) => r.data),
};

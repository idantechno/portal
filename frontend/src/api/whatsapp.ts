import { api } from "./client";

export type WhatsappStatus = "pending" | "active" | "failed";

export interface WhatsappConnectionPublic {
  id: string;
  businessId: string;
  phoneNumberId: string | null;
  wabaId: string | null;
  metaBusinessId: string | null;
  displayPhoneNumber: string | null;
  status: WhatsappStatus;
  lastError: string | null;
  connectedAt: string | null;
  hasAccessToken: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmbeddedSignupExchangeInput {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  metaBusinessId?: string;
}

export const whatsappApi = {
  get: (businessId: string) =>
    api
      .get<WhatsappConnectionPublic | null>(
        `/businesses/${businessId}/channels/whatsapp`,
      )
      .then((r) => r.data),

  exchange: (businessId: string, input: EmbeddedSignupExchangeInput) =>
    api
      .post<WhatsappConnectionPublic>(
        `/businesses/${businessId}/channels/whatsapp/embedded-signup`,
        input,
      )
      .then((r) => r.data),

  delete: (businessId: string) =>
    api
      .delete<{ ok: boolean }>(`/businesses/${businessId}/channels/whatsapp`)
      .then((r) => r.data),
};

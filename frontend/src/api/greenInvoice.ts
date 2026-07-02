import { api } from "./client";

export interface GreenInvoiceStatus {
  connected: boolean;
  environment: "sandbox" | "production";
  accountName: string | null;
  connectedAt: string | null;
}

export interface IssueInvoiceBody {
  customerName: string;
  customerEmail?: string;
  customerTaxId?: string;
  items: { description: string; quantity: number; price: number }[];
}

export const greenInvoiceApi = {
  status: (businessId: string) =>
    api
      .get<GreenInvoiceStatus>(`/businesses/${businessId}/green-invoice/status`)
      .then((r) => r.data),
  connect: (
    businessId: string,
    body: { apiKeyId: string; apiSecret: string; environment: "sandbox" | "production" },
  ) =>
    api
      .post<GreenInvoiceStatus>(
        `/businesses/${businessId}/green-invoice/connect`,
        body,
      )
      .then((r) => r.data),
  disconnect: (businessId: string) =>
    api
      .post(`/businesses/${businessId}/green-invoice/disconnect`)
      .then((r) => r.data),
  issue: (businessId: string, body: IssueInvoiceBody) =>
    api
      .post<{ id: string; number?: string; url?: string }>(
        `/businesses/${businessId}/green-invoice/issue`,
        body,
      )
      .then((r) => r.data),
};

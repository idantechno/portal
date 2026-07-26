import { api } from "./client";

export interface BillingPlan {
  code: string;
  name: string;
  priceCents: number;
  interval: "month" | "year";
  currency: string;
  features: string[];
}

export interface ProviderStatus {
  name: "grow" | "greeninvoice";
  label: string;
  configured: boolean;
}

export interface Subscription {
  id: string;
  businessId: string;
  planCode: string;
  status: "active" | "trialing" | "past_due" | "canceled";
  provider: "manual" | "grow" | "stripe" | "greeninvoice";
  currentPeriodEnd: string | null;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Invoice {
  id: string;
  businessId: string;
  number: string;
  status: "draft" | "sent" | "paid" | "void";
  customerName: string | null;
  amountCents: number;
  currency: string;
  lineItems: InvoiceLineItem[];
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export const billingApi = {
  plans: (businessId: string) =>
    api
      .get<{ plans: BillingPlan[]; providers: ProviderStatus[] }>(
        `/businesses/${businessId}/billing/plans`,
      )
      .then((r) => r.data),
  subscription: (businessId: string) =>
    api
      .get<Subscription>(`/businesses/${businessId}/billing/subscription`)
      .then((r) => r.data),
  setPlan: (businessId: string, planCode: string) =>
    api
      .put<Subscription>(`/businesses/${businessId}/billing/subscription`, {
        planCode,
      })
      .then((r) => r.data),
  checkout: (businessId: string, planCode: string) =>
    api
      .post<{ url: string }>(`/businesses/${businessId}/billing/checkout`, {
        planCode,
      })
      .then((r) => r.data.url),
  confirmCheckout: (businessId: string, sessionId: string) =>
    api
      .post<Subscription>(
        `/businesses/${businessId}/billing/checkout/confirm`,
        { sessionId },
      )
      .then((r) => r.data),
  invoices: (businessId: string) =>
    api
      .get<Invoice[]>(`/businesses/${businessId}/billing/invoices`)
      .then((r) => r.data),
  createInvoice: (
    businessId: string,
    body: { customerName?: string; lineItems: InvoiceLineItem[]; dueAt?: string },
  ) =>
    api
      .post<Invoice>(`/businesses/${businessId}/billing/invoices`, body)
      .then((r) => r.data),
  markPaid: (businessId: string, id: string) =>
    api
      .post<Invoice>(`/businesses/${businessId}/billing/invoices/${id}/paid`)
      .then((r) => r.data),
};

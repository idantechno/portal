import { api } from "./client";

export type QuoteStatus = "draft" | "approved";

export interface QuoteChannel {
  name: string;
  description: string;
  budget: string;
}

export interface Quote {
  id: string;
  businessId: string;
  customerId: string;
  title: string;
  status: QuoteStatus;
  journey: string;
  channels: QuoteChannel[];
  budgetSummary: string;
  total: string | null;
  notes: string | null;
  /** Rendered deliverable — present on the single-quote GET. */
  markdown?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteInput {
  title?: string;
  status?: QuoteStatus;
  journey?: string;
  channels?: QuoteChannel[];
  budgetSummary?: string;
  total?: string;
  notes?: string;
}

export const quotesApi = {
  list: (businessId: string, customerId?: string) =>
    api
      .get<Quote[]>(`/businesses/${businessId}/quotes`, {
        params: customerId ? { customerId } : undefined,
      })
      .then((r) => r.data),

  get: (businessId: string, id: string) =>
    api.get<Quote>(`/businesses/${businessId}/quotes/${id}`).then((r) => r.data),

  create: (businessId: string, customerId: string, input: QuoteInput) =>
    api
      .post<Quote>(
        `/businesses/${businessId}/customers/${customerId}/quotes`,
        input,
      )
      .then((r) => r.data),

  update: (businessId: string, id: string, patch: QuoteInput) =>
    api
      .patch<Quote>(`/businesses/${businessId}/quotes/${id}`, patch)
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: true }>(`/businesses/${businessId}/quotes/${id}`)
      .then((r) => r.data),
};

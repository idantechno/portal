import { api } from "./client";

export type QuoteStatus = "draft" | "approved";

export interface QuoteChannel {
  name: string;
  description: string;
  budget: string;
}

/** A priced line — the business-agnostic quote body. */
export interface QuoteLineItem {
  name: string;
  description: string;
  /** Free text, operator-filled. The AI drafter always leaves this empty. */
  amount: string;
}

export interface Quote {
  id: string;
  businessId: string;
  customerId: string;
  title: string;
  status: QuoteStatus;
  /** Flexible structure (primary). */
  intro: string;
  lineItems: QuoteLineItem[];
  /** Legacy marketing structure (older quotes). */
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
  intro?: string;
  lineItems?: QuoteLineItem[];
  journey?: string;
  channels?: QuoteChannel[];
  budgetSummary?: string;
  total?: string;
  notes?: string;
}

/** What the AI drafter returns — prices deliberately absent. */
export interface QuoteDraft {
  intro: string;
  lineItems: QuoteLineItem[];
  terms: string;
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

  /** AI-draft a business-tailored quote body from a one-line brief. */
  draft: (businessId: string, id: string, brief: string) =>
    api
      .post<QuoteDraft | null>(
        `/businesses/${businessId}/quotes/${id}/draft`,
        { brief },
      )
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: true }>(`/businesses/${businessId}/quotes/${id}`)
      .then((r) => r.data),
};

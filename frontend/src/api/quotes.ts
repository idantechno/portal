import { api } from "./client";

export type QuoteStatus = "draft" | "approved";

export type QuoteTemplate =
  | "classic"
  | "sidebar"
  | "bold"
  | "minimal"
  | "editorial";

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
  /** Chosen PDF design. */
  template: QuoteTemplate;
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
  template?: QuoteTemplate;
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

  /** AI-draft a business-tailored quote body from a brief OR pasted content. */
  draft: (businessId: string, id: string, brief: string) =>
    api
      .post<QuoteDraft | null>(
        `/businesses/${businessId}/quotes/${id}/draft`,
        { brief },
      )
      .then((r) => r.data),

  /** The rendered branded PDF as a Blob (for download / preview). */
  pdf: (businessId: string, id: string) =>
    api
      .get<Blob>(`/businesses/${businessId}/quotes/${id}/pdf`, {
        responseType: "blob",
      })
      .then((r) => r.data),

  /** Ensure a public link and get its URL — for sending to the client. */
  share: (businessId: string, id: string) =>
    api
      .post<{ token: string; publicUrl: string }>(
        `/businesses/${businessId}/quotes/${id}/share`,
      )
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: true }>(`/businesses/${businessId}/quotes/${id}`)
      .then((r) => r.data),
};

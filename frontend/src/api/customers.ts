import { api } from "./client";

export type CustomerSource =
  | "manual"
  | "lead"
  | "contact"
  | "agent"
  | "questionnaire"
  | "intake";
export type CustomerSort = "recent" | "alpha" | "next_activity";
/** Lifecycle stage of a person — the canonical Contact/Lead/Customer axis. */
export type CustomerStage = "lead" | "customer";

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  businessName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  source: CustomerSource;
  /** Lifecycle stage — drives the unified אנשי קשר לידים/לקוחות tabs. */
  stage: CustomerStage;
  /** Free-text interest captured at intake, if any. */
  interest: string | null;
  /** Finer-grained provenance than `source` (form/campaign/page). */
  sourceDetail: string | null;
  /** Structured intake payload (questionnaire answers, tool args, UTM…). */
  capturedData: Record<string, unknown> | null;
  leadId: string | null;
  customerContactId: string | null;
  brandPageReady: boolean;
  brandPageUrl: string | null;
  logoReady: boolean;
  logoUrl: string | null;
  becameCustomerAt: string;
  nextActivityAt: string | null;
  nextActivityNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  businessName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  nextActivityAt?: string;
  nextActivityNote?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  businessName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  brandPageReady?: boolean;
  brandPageUrl?: string | null;
  logoReady?: boolean;
  logoUrl?: string | null;
  nextActivityAt?: string | null;
  nextActivityNote?: string | null;
}

export const customersApi = {
  /**
   * People for a business. `sort` orders the list; the optional `stage` narrows
   * to one lifecycle stage (lead|customer) for the unified אנשי קשר tabs.
   * Omitting `stage` returns every person, unchanged.
   */
  list: (
    businessId: string,
    params: { sort?: CustomerSort; stage?: CustomerStage } = {},
  ) =>
    api
      .get<Customer[]>(`/businesses/${businessId}/customers`, {
        params: { sort: params.sort ?? "recent", stage: params.stage },
      })
      .then((r) => r.data),

  get: (businessId: string, id: string) =>
    api
      .get<Customer>(`/businesses/${businessId}/customers/${id}`)
      .then((r) => r.data),

  create: (businessId: string, input: CreateCustomerInput) =>
    api
      .post<Customer>(`/businesses/${businessId}/customers`, input)
      .then((r) => r.data),

  /** Promote a questionnaire/agent lead into a customer. */
  createFromLead: (businessId: string, leadId: string) =>
    api
      .post<Customer>(`/businesses/${businessId}/customers/from-lead/${leadId}`)
      .then((r) => r.data),

  /** Promote a conversation contact (WhatsApp/web) into a customer. */
  createFromContact: (businessId: string, contactId: string) =>
    api
      .post<Customer>(
        `/businesses/${businessId}/customers/from-contact/${contactId}`,
      )
      .then((r) => r.data),

  update: (businessId: string, id: string, patch: UpdateCustomerInput) =>
    api
      .patch<Customer>(`/businesses/${businessId}/customers/${id}`, patch)
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: true }>(`/businesses/${businessId}/customers/${id}`)
      .then((r) => r.data),
};

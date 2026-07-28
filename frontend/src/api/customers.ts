import { api } from "./client";

export type CustomerSource = "manual" | "lead" | "contact";
export type CustomerSort = "recent" | "alpha" | "next_activity";

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  businessName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  source: CustomerSource;
  leadId: string | null;
  customerContactId: string | null;
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
  nextActivityAt?: string | null;
  nextActivityNote?: string | null;
}

export const customersApi = {
  list: (businessId: string, sort: CustomerSort = "recent") =>
    api
      .get<Customer[]>(`/businesses/${businessId}/customers`, {
        params: { sort },
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

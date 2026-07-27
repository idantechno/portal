import { api } from "./client";

/**
 * "Right to be forgotten" — permanently erase one end-customer's personal data.
 * Backed by DELETE /businesses/:id/privacy/... (business Admins and up).
 */
export const privacyApi = {
  /** Delete a contact + their conversations, messages, appointments and leads. */
  eraseContact: (businessId: string, contactId: string) =>
    api
      .delete(`/businesses/${businessId}/privacy/contacts/${contactId}`)
      .then((r) => r.data),

  /** Delete a single lead (e.g. a standalone questionnaire submission). */
  eraseLead: (businessId: string, leadId: string) =>
    api
      .delete(`/businesses/${businessId}/privacy/leads/${leadId}`)
      .then((r) => r.data),
};

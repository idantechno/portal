import { api } from "./client";

export type MailItemStatus = "pending" | "approved" | "dismissed";

export interface MailItem {
  id: string;
  detector: string;
  status: MailItemStatus;
  fromAddress: string;
  subject: string;
  snippet: string | null;
  receivedAt: string;
  hasAttachment: boolean;
  attachmentName: string | null;
  /** Set once approved and turned into an expense. */
  expenseId: string | null;
  createdAt: string;
}

export const mailApi = {
  list: (businessId: string, status?: MailItemStatus) =>
    api
      .get<MailItem[]>(`/businesses/${businessId}/mail-items`, {
        params: status ? { status } : undefined,
      })
      .then((r) => r.data),
  approve: (businessId: string, id: string) =>
    api
      .post<MailItem>(`/businesses/${businessId}/mail-items/${id}/approve`)
      .then((r) => r.data),
  dismiss: (businessId: string, id: string) =>
    api
      .post<MailItem>(`/businesses/${businessId}/mail-items/${id}/dismiss`)
      .then((r) => r.data),
};

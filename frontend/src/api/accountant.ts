import { api } from "./client";

export interface AccountantStatus {
  hasEmail: boolean;
  hasPhone: boolean;
}

export interface AccountantSendResult {
  periodLabel: string;
  expenseCount: number;
  filesAttached: number;
  missingFiles: number;
  totalIls: number;
  emailedTo: string | null;
  emailError: string | null;
  whatsappedTo: string | null;
  whatsappError: string | null;
}

export const accountantApi = {
  status: (businessId: string) =>
    api
      .get<AccountantStatus>(`/businesses/${businessId}/accountant/status`)
      .then((r) => r.data),
  send: (businessId: string, body?: { year?: number; month?: number }) =>
    api
      .post<AccountantSendResult>(
        `/businesses/${businessId}/accountant/send`,
        body ?? {},
      )
      .then((r) => r.data),
};

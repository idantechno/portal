import { api } from "./client";

export type ExpenseKind = "fixed" | "occasional";
export type ExpenseStatus = "parsed" | "manual" | "failed" | "pending";

export interface Expense {
  id: string;
  businessId: string;
  title: string;
  kind: ExpenseKind;
  amountCents: number | null;
  currency: string;
  expenseDate: string | null;
  fileName: string | null;
  relativePath: string | null;
  mimeType: string | null;
  size: number | null;
  status: ExpenseStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  fixedMonthlyCents: number;
  occasionalThisMonthCents: number;
  monthlyTotalCents: number;
  fixedCount: number;
  occasionalCount: number;
  count: number;
}

export const expensesApi = {
  list: (businessId: string) =>
    api.get<Expense[]>(`/businesses/${businessId}/expenses`).then((r) => r.data),

  summary: (businessId: string) =>
    api
      .get<ExpenseSummary>(`/businesses/${businessId}/expenses/summary`)
      .then((r) => r.data),

  create: (
    businessId: string,
    input: {
      file?: File;
      kind?: ExpenseKind;
      title?: string;
      amountCents?: number;
      expenseDate?: string;
    },
  ) => {
    const fd = new FormData();
    if (input.file) fd.append("file", input.file);
    if (input.kind) fd.append("kind", input.kind);
    if (input.title) fd.append("title", input.title);
    if (input.amountCents != null)
      fd.append("amountCents", String(input.amountCents));
    if (input.expenseDate) fd.append("expenseDate", input.expenseDate);
    return api
      .post<Expense>(`/businesses/${businessId}/expenses`, fd)
      .then((r) => r.data);
  },

  update: (
    businessId: string,
    id: string,
    patch: {
      title?: string;
      kind?: ExpenseKind;
      amountCents?: number | null;
      expenseDate?: string | null;
      note?: string | null;
    },
  ) =>
    api
      .patch<Expense>(`/businesses/${businessId}/expenses/${id}`, patch)
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete(`/businesses/${businessId}/expenses/${id}`)
      .then((r) => r.data),

  fetchBlob: (businessId: string, id: string) =>
    api
      .get<Blob>(`/businesses/${businessId}/expenses/${id}/file`, {
        responseType: "blob",
      })
      .then((r) => r.data),
};

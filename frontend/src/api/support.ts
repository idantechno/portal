import { api } from "./client";

export interface SupportRequestBody {
  message: string;
  subject?: string;
}

export const supportApi = {
  /** Owner-facing: file a help/support request to the operator's inbox. */
  create: (businessId: string, body: SupportRequestBody) =>
    api
      .post<{ ok: true }>(
        `/businesses/${businessId}/support-requests`,
        body,
      )
      .then((r) => r.data),
};

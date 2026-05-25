import { api } from "./client";

export interface Lead {
  id: string;
  businessId: string;
  conversationId: string;
  customerContactId: string;
  name: string;
  phone: string | null;
  email: string | null;
  interest: string;
  notes: string | null;
  createdAt: string;
}

export const leadsApi = {
  list: (businessId: string) =>
    api.get<Lead[]>(`/businesses/${businessId}/leads`).then((r) => r.data),
};

import { api } from "./client";

export interface LeadAnswerSection {
  title: string;
  items: { label: string; value: string }[];
}

export interface LeadAnswers {
  businessName?: string;
  businessType?: string;
  audience?: string;
  preferredChannel?: string | null;
  contactName?: string;
  phone?: string | null;
  email?: string | null;
  sections?: LeadAnswerSection[];
}

export interface Lead {
  id: string;
  businessId: string;
  conversationId: string | null;
  customerContactId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  interest: string;
  notes: string | null;
  source: "agent" | "questionnaire";
  answers: LeadAnswers | null;
  createdAt: string;
}

export const leadsApi = {
  list: (businessId: string) =>
    api.get<Lead[]>(`/businesses/${businessId}/leads`).then((r) => r.data),
};

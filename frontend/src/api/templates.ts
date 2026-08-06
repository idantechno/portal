import { api } from "./client";

export type TemplateTrigger = "reminder" | "appointment_booked";

/** Business-facing catalog entry — what the Chat Agent page lists. */
export interface TemplateListView {
  name: string;
  title: string;
  description: string;
  defaultEnabled: boolean;
  trigger: TemplateTrigger;
  entitled: boolean;
}

/** Admin-facing entry — catalog + effective state + source. */
export interface TemplateAccessView {
  name: string;
  title: string;
  description: string;
  defaultEnabled: boolean;
  trigger: TemplateTrigger;
  enabled: boolean;
  overridden: boolean;
  catalogDefault: boolean;
}

export const templatesApi = {
  forBusiness: (businessId: string) =>
    api
      .get<TemplateListView[]>(`/businesses/${businessId}/templates`)
      .then((r) => r.data),
};

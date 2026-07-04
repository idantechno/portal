import { api } from "./client";

export interface GoogleCalEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
}

export const calendarApi = {
  status: (businessId: string) =>
    api
      .get<{ connected: boolean }>(`/businesses/${businessId}/calendar/status`)
      .then((r) => r.data),

  googleEvents: (businessId: string, from: string, to: string) =>
    api
      .get<GoogleCalEvent[]>(
        `/businesses/${businessId}/calendar/google-events`,
        { params: { from, to } },
      )
      .then((r) => r.data),

  createEvent: (
    businessId: string,
    body: { title: string; start: string; end?: string },
  ) =>
    api
      .post<GoogleCalEvent>(
        `/businesses/${businessId}/calendar/google-events`,
        body,
      )
      .then((r) => r.data),
};

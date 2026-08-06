import { api } from "./client";

export type AgendaSource = "appointment" | "task" | "calendar" | "reminder";

export interface AgendaItem {
  source: AgendaSource;
  title: string;
  start: string;
  end: string | null;
}

export interface AgendaConflict {
  a: string;
  b: string;
}

export interface Agenda {
  items: AgendaItem[];
  conflicts: AgendaConflict[];
}

export const scheduleApi = {
  /** Unified timeline (appointments + tasks + calendar + reminders) for a window. */
  agenda: (businessId: string, fromISO: string, toISO: string) =>
    api
      .get<Agenda>(`/businesses/${businessId}/schedule/agenda`, {
        params: { from: fromISO, to: toISO },
      })
      .then((r) => r.data),
};

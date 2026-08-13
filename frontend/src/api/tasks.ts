import { api } from "./client";

export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
/** A to-do the owner tracks ("משימות") vs a pure nudge ("תזכורות"). */
export type TaskKind = "task" | "reminder";

export interface Task {
  id: string;
  businessId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Task (to-do) or reminder (nudge). */
  kind: TaskKind;
  source: "manual" | "automation" | "agent";
  dueAt: string | null;
  /** How long a dated task takes, minutes. Null → a flat 30-min block. */
  durationMinutes: number | null;
  completedAt: string | null;
  /** When this task's reminder is enabled, the reminders agent nudges the owner. */
  remindEnabled: boolean;
  /** When the reminder fires — distinct from dueAt (when the event happens). */
  remindAt: string | null;
  remindCustomerPhone: string | null;
  remindCustomerName: string | null;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskBody {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueAt?: string;
  /** How long a dated task takes, in minutes (default 30). */
  durationMinutes?: number;
  /** 'reminder' for a standalone reminder in the תזכורות tab; else a task. */
  kind?: TaskKind;
  remindEnabled?: boolean;
  remindAt?: string;
  /** Optional customer to also remind (their WhatsApp number + name). */
  remindCustomerPhone?: string | null;
  remindCustomerName?: string | null;
}

export const tasksApi = {
  /**
   * `kind:'task'` → the משימות list; `reminders:true` → the תזכורות list
   * (everything reminder-enabled). Omit both for every row (e.g. month grid).
   */
  list: (
    businessId: string,
    opts: { status?: TaskStatus; kind?: TaskKind; reminders?: boolean } = {},
  ) =>
    api
      .get<Task[]>(`/businesses/${businessId}/tasks`, {
        params: {
          ...(opts.status ? { status: opts.status } : {}),
          ...(opts.kind ? { kind: opts.kind } : {}),
          ...(opts.reminders ? { reminders: true } : {}),
        },
      })
      .then((r) => r.data),
  create: (businessId: string, body: CreateTaskBody) =>
    api
      .post<Task>(`/businesses/${businessId}/tasks`, body)
      .then((r) => r.data),
  update: (
    businessId: string,
    id: string,
    body: Partial<CreateTaskBody> & {
      status?: TaskStatus;
      remindEnabled?: boolean;
      remindAt?: string | null;
    },
  ) =>
    api
      .patch<Task>(`/businesses/${businessId}/tasks/${id}`, body)
      .then((r) => r.data),
  remove: (businessId: string, id: string) =>
    api.delete(`/businesses/${businessId}/tasks/${id}`).then((r) => r.data),
};

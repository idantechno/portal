import { api } from "./client";

export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  businessId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  source: "manual" | "automation" | "agent";
  dueAt: string | null;
  completedAt: string | null;
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
}

export const tasksApi = {
  list: (businessId: string, status?: TaskStatus) =>
    api
      .get<Task[]>(`/businesses/${businessId}/tasks`, {
        params: status ? { status } : undefined,
      })
      .then((r) => r.data),
  create: (businessId: string, body: CreateTaskBody) =>
    api
      .post<Task>(`/businesses/${businessId}/tasks`, body)
      .then((r) => r.data),
  update: (businessId: string, id: string, body: Partial<CreateTaskBody> & { status?: TaskStatus }) =>
    api
      .patch<Task>(`/businesses/${businessId}/tasks/${id}`, body)
      .then((r) => r.data),
  remove: (businessId: string, id: string) =>
    api.delete(`/businesses/${businessId}/tasks/${id}`).then((r) => r.data),
};

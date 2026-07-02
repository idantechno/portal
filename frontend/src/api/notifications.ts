import { api } from "./client";

export type NotificationType =
  | "lead"
  | "message"
  | "task"
  | "document"
  | "billing"
  | "automation"
  | "system";

export interface AppNotification {
  id: string;
  businessId: string;
  userId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (businessId: string, unreadOnly = false) =>
    api
      .get<AppNotification[]>(`/businesses/${businessId}/notifications`, {
        params: unreadOnly ? { unread: "true" } : undefined,
      })
      .then((r) => r.data),
  unreadCount: (businessId: string) =>
    api
      .get<{ count: number }>(
        `/businesses/${businessId}/notifications/unread-count`,
      )
      .then((r) => r.data.count),
  markRead: (businessId: string, id: string) =>
    api
      .post(`/businesses/${businessId}/notifications/${id}/read`)
      .then((r) => r.data),
  markAllRead: (businessId: string) =>
    api
      .post(`/businesses/${businessId}/notifications/read-all`)
      .then((r) => r.data),
};

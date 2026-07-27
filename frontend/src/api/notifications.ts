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
  vapidPublicKey: (businessId: string) =>
    api
      .get<{ publicKey: string }>(
        `/businesses/${businessId}/notifications/push/vapid-key`,
      )
      .then((r) => r.data.publicKey),
  subscribePush: (
    businessId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string },
  ) =>
    api
      .post(`/businesses/${businessId}/notifications/push/subscribe`, sub)
      .then((r) => r.data),
  unsubscribePush: (businessId: string, endpoint: string) =>
    api
      .post(`/businesses/${businessId}/notifications/push/unsubscribe`, {
        endpoint,
      })
      .then((r) => r.data),
};

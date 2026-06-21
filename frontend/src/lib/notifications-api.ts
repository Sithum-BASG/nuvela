import { apiFetch } from "./api-client";

export type NotificationType =
  | "TASK_ASSIGNED"
  | "STATUS_CHANGED"
  | "MENTION"
  | "DEADLINE"
  | "PROJECT_TRANSFERRED";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

export const notificationsApi = {
  list: (unread?: boolean) =>
    apiFetch<NotificationRow[]>(
      `/notifications${unread ? "?unread=true" : ""}`,
    ),
  markRead: (id: string) =>
    apiFetch<void>(`/notifications/${id}/read`, "PATCH"),
  markAllRead: () => apiFetch<void>("/notifications/read-all", "POST"),
};

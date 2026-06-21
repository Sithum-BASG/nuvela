import { apiFetch } from "./api-client";

export type ActivityType =
  | "STATUS_CHANGED"
  | "ASSIGNED"
  | "UNASSIGNED"
  | "FIELD_CHANGED"
  | "CHECKLIST_CHECKED"
  | "CHECKLIST_UNCHECKED"
  | "ATTACHMENT_ADDED"
  | "COMMENT_ADDED";

export type ActivityRow = {
  id: string;
  type: ActivityType;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string };
};

export const activityApi = {
  list: (taskId: string) =>
    apiFetch<ActivityRow[]>(`/tasks/${taskId}/activity`),
};

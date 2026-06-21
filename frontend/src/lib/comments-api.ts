import { apiFetch } from "./api-client";

export type CommentRow = {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
  mentions: { userId: string; name: string }[];
};

export const commentsApi = {
  list: (taskId: string) =>
    apiFetch<CommentRow[]>(`/tasks/${taskId}/comments`),
  create: (taskId: string, input: { body: string; mentionedUserIds?: string[] }) =>
    apiFetch<CommentRow>(`/tasks/${taskId}/comments`, "POST", input),
  remove: (commentId: string) =>
    apiFetch<void>(`/comments/${commentId}`, "DELETE"),
};

import { apiFetch } from "./api-client";

export type AttachmentRow = {
  id: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
};

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const attachmentsApi = {
  list: (taskId: string) =>
    apiFetch<AttachmentRow[]>(`/tasks/${taskId}/attachments`),
  signedUrl: (id: string) =>
    apiFetch<{ url: string }>(`/attachments/${id}/url`),
  remove: (id: string) => apiFetch<void>(`/attachments/${id}`, "DELETE"),
  upload: async (taskId: string, file: File): Promise<AttachmentRow> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/tasks/${taskId}/attachments`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      throw Object.assign(new Error(data.message ?? res.statusText), {
        status: res.status,
        code: data.code ?? "ERROR",
      });
    }
    return res.json() as Promise<AttachmentRow>;
  },
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

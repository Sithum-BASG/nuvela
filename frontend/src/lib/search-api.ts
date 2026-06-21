import { apiFetch } from "./api-client";

export type SearchResult = {
  taskId: string;
  title: string;
  projectId: string;
  projectName: string;
  columnName: string;
  dueDate: string | null;
};

export const searchApi = {
  query: (q: string) =>
    apiFetch<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
};

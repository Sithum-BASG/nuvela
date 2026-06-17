import { apiFetch } from "./api-client";
import type {
  ProjectRow,
  MemberRow,
  CreateProjectInput,
  UpdateProjectInput,
  TransferProjectInput,
  AddMemberInput,
} from "./projects-api.types";

export const projectsApi = {
  list: () => apiFetch<ProjectRow[]>("/projects"),
  listArchived: () => apiFetch<ProjectRow[]>("/projects/archived"),
  get: (id: string) => apiFetch<ProjectRow>(`/projects/${id}`),
  create: (input: CreateProjectInput) => apiFetch<ProjectRow>("/projects", "POST", input),
  update: (id: string, input: UpdateProjectInput) =>
    apiFetch<ProjectRow>(`/projects/${id}`, "PATCH", input),
  archive: (id: string) => apiFetch<void>(`/projects/${id}/archive`, "POST"),
  unarchive: (id: string) => apiFetch<void>(`/projects/${id}/unarchive`, "POST"),
  transfer: (id: string, input: TransferProjectInput) =>
    apiFetch<ProjectRow>(`/projects/${id}/transfer`, "POST", input),
  members: {
    list: (projectId: string) => apiFetch<MemberRow[]>(`/projects/${projectId}/members`),
    inviteDirectory: (projectId: string, search?: string) =>
      apiFetch<{ id: string; name: string; email: string; role: string }[]>(
        `/projects/${projectId}/members/invite-directory${
          search ? `?search=${encodeURIComponent(search)}` : ""
        }`,
      ),
    add: (projectId: string, input: AddMemberInput) =>
      apiFetch<MemberRow>(`/projects/${projectId}/members`, "POST", input),
    remove: (projectId: string, userId: string, body?: unknown) =>
      apiFetch<{ assignedTasks?: { id: string; title: string }[] }>(
        `/projects/${projectId}/members/${userId}`,
        "DELETE",
        body,
      ),
  },
};

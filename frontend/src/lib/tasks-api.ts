import { apiFetch } from "./api-client";
import type {
  ColumnRow,
  TaskRow,
  ChecklistItemRow,
  LabelRow,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  CreateLabelInput,
  UpdateLabelInput,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from "./tasks-api.types";

export const tasksApi = {
  columns: {
    list: (projectId: string) =>
      apiFetch<ColumnRow[]>(`/projects/${projectId}/columns`),
  },

  tasks: {
    list: (projectId: string) =>
      apiFetch<TaskRow[]>(`/projects/${projectId}/tasks`),
    get: (taskId: string) => apiFetch<TaskRow>(`/tasks/${taskId}`),
    create: (projectId: string, input: CreateTaskInput) =>
      apiFetch<TaskRow>(`/projects/${projectId}/tasks`, "POST", input),
    update: (taskId: string, input: UpdateTaskInput) =>
      apiFetch<TaskRow>(`/tasks/${taskId}`, "PATCH", input),
    delete: (taskId: string) =>
      apiFetch<void>(`/tasks/${taskId}`, "DELETE"),
    move: (taskId: string, input: MoveTaskInput) =>
      apiFetch<TaskRow>(`/tasks/${taskId}/move`, "PATCH", input),
    assignees: {
      add: (taskId: string, userId: string) =>
        apiFetch<TaskRow>(`/tasks/${taskId}/assignees`, "POST", { userId }),
      remove: (taskId: string, userId: string) =>
        apiFetch<void>(`/tasks/${taskId}/assignees/${userId}`, "DELETE"),
    },
  },

  labels: {
    list: (projectId: string) =>
      apiFetch<LabelRow[]>(`/projects/${projectId}/labels`),
    create: (projectId: string, input: CreateLabelInput) =>
      apiFetch<LabelRow>(`/projects/${projectId}/labels`, "POST", input),
    update: (labelId: string, input: UpdateLabelInput) =>
      apiFetch<LabelRow>(`/labels/${labelId}`, "PATCH", input),
    delete: (labelId: string) =>
      apiFetch<void>(`/labels/${labelId}`, "DELETE"),
    apply: (taskId: string, labelId: string) =>
      apiFetch<void>(`/tasks/${taskId}/labels`, "POST", { labelId }),
    remove: (taskId: string, labelId: string) =>
      apiFetch<void>(`/tasks/${taskId}/labels/${labelId}`, "DELETE"),
  },

  checklist: {
    add: (taskId: string, input: CreateChecklistItemInput) =>
      apiFetch<ChecklistItemRow>(`/tasks/${taskId}/checklist`, "POST", input),
    update: (itemId: string, input: UpdateChecklistItemInput) =>
      apiFetch<ChecklistItemRow>(`/checklist/${itemId}`, "PATCH", input),
    delete: (itemId: string) =>
      apiFetch<void>(`/checklist/${itemId}`, "DELETE"),
  },
};

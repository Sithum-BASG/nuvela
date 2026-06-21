import { apiFetch } from "./api-client";

export type MyTaskRow = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  columnName: string;
  isCompletedColumn: boolean;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
};

export type ProjectProgressRow = {
  id: string;
  name: string;
  color: string;
  totalTasks: number;
  completedTasks: number;
};

export type OrgOverview = {
  userCounts: {
    OWNER: number;
    ADMIN: number;
    PROJECT_MANAGER: number;
    COLLABORATOR: number;
  };
  pendingInvites: number;
  projectCount: number;
  recentUsers: {
    id: string;
    name: string;
    role: string;
    status: string;
    createdAt: string;
  }[];
};

export const dashboardApi = {
  myWork: () =>
    apiFetch<{ tasks: MyTaskRow[]; projects: ProjectProgressRow[] }>(
      "/dashboard/my-work",
    ),
  orgOverview: () => apiFetch<OrgOverview>("/dashboard/org-overview"),
};

// Shapes returned by the NestJS /projects + /projects/:id/members endpoints.
// ProjectRow mirrors backend ProjectRow (projects.service.ts PROJECT_SELECT +
// computed memberCount); MemberRow mirrors the members listing. The frontend
// never derives authorization from these — the API enforces RBAC (404 hides
// cross-tenant existence) and we render whatever it returns.
export type ProjectRow = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string;
  status: "ACTIVE" | "ARCHIVED";
  managerId: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  addedAt: string;
};

export type CreateProjectInput = { name: string; description?: string; color: string };
export type UpdateProjectInput = Partial<CreateProjectInput>;
export type TransferProjectInput = { newManagerId: string };
export type AddMemberInput = { userId: string };
export type RemoveMemberInput = {
  reassignments?: { taskId: string; newAssigneeId: string | null }[];
};

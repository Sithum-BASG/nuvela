export type UserRole = "OWNER" | "ADMIN" | "PROJECT_MANAGER" | "COLLABORATOR";
export type UserStatus = "ACTIVE" | "PENDING" | "DEACTIVATED";

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface CreateUserDto {
  name: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserDto {
  name?: string;
  role?: UserRole;
}

export interface DeactivateResponse {
  done: boolean;
  projects?: { id: string; name: string }[];
}

export interface TransferEntry {
  projectId: string;
  newManagerId: string;
}

export interface ResendInviteResponse {
  ok: boolean;
}

export interface ProjectStub {
  id: string;
  name: string;
}

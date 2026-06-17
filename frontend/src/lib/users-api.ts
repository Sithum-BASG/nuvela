import { apiFetch } from "./api-client";
import type {
  OrgUser,
  CreateUserDto,
  UpdateUserDto,
  DeactivateResponse,
  TransferEntry,
  ResendInviteResponse,
} from "./users-api.types";

export function listUsers(): Promise<OrgUser[]> {
  return apiFetch<OrgUser[]>("/users");
}

export function createUser(dto: CreateUserDto): Promise<OrgUser> {
  return apiFetch<OrgUser>("/users", "POST", dto);
}

export function updateUser(userId: string, dto: UpdateUserDto): Promise<OrgUser> {
  return apiFetch<OrgUser>(`/users/${userId}`, "PATCH", dto);
}

export function deactivateUser(
  userId: string,
  transfers?: TransferEntry[],
): Promise<DeactivateResponse> {
  return apiFetch<DeactivateResponse>(`/users/${userId}/deactivate`, "POST", transfers ? { transfers } : {});
}

export function reactivateUser(userId: string): Promise<OrgUser> {
  return apiFetch<OrgUser>(`/users/${userId}/reactivate`, "POST");
}

export function resendInvite(userId: string): Promise<ResendInviteResponse> {
  return apiFetch<ResendInviteResponse>(`/users/${userId}/resend-invite`, "POST");
}

/** Maps backend `code` values to user-facing copy (App Flow error catalog). */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Incorrect email or password.",
  EMAIL_NOT_VERIFIED: "Verify your email before logging in.",
  ACCOUNT_DEACTIVATED: "This account is deactivated. Contact your administrator.",
  INVALID_TOKEN: "This link is invalid or has expired.",
  INVALID_REFRESH: "Your session expired. Please log in again.",
  INVALID_SESSION: "Your session expired. Please log in again.",
  UNAUTHORIZED: "Your session expired. Please log in again.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you're looking for.",
  EMAIL_EXISTS: "A user with this email already exists.",
  PM_GATED: "Only a Project Manager can move tasks into Completed.",
  NOT_ASSIGNEE: "You can only move tasks you are assigned to.",
  TASKS_NEED_REASSIGNMENT: "Reassign open tasks before removing this member.",
  FILE_TOO_LARGE: "File is too large. Maximum size is 10 MB.",
  UNSUPPORTED_TYPE: "This file type isn't supported.",
  PROJECT_ARCHIVED: "This project is archived and can't be changed.",
  NOT_A_MEMBER: "You don't have access to this project.",
  CANNOT_DEACTIVATE_OWNER: "The organization owner can't be deactivated.",
  INVALID_TRANSFER_TARGET: "Choose a valid project manager for transfer.",
  UPLOAD_FAILED: "Upload failed. Please try again.",
};

export function getFriendlyErrorMessage(
  code: string | undefined,
  fallback?: string,
): string {
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (fallback && typeof fallback === "string" && fallback.trim()) return fallback;
  return "Something went wrong. Please try again.";
}

export function getFieldErrorMessage(
  code: string | undefined,
  field: string,
  fallback?: string,
): string | undefined {
  if (code === "EMAIL_EXISTS" && field === "email") {
    return MESSAGES.EMAIL_EXISTS;
  }
  return fallback;
}

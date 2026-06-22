// Typed client for the NestJS /auth/* endpoints. All requests send the
// HTTP-only auth cookies (credentials: "include"). On a 401 it attempts one
// silent /auth/refresh and retries once, per the App Flow's silent-refresh rule.
import { getFriendlyErrorMessage } from "@/lib/error-messages";
import { redirectSessionExpired } from "@/lib/session-expired";
import { isLoggingOut } from "@/lib/session-state";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "PROJECT_MANAGER" | "COLLABORATOR";
  organizationId: string;
  mustResetPassword: boolean;
};

export type LoginResult = {
  user: Omit<SessionUser, "mustResetPassword">;
  mustResetPassword: boolean;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Body = Record<string, unknown>;

async function rawFetch(
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: Body,
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Endpoints where a 401 must NOT trigger a refresh+retry (the 401 is meaningful).
const NO_REFRESH = new Set([
  "/auth/login",
  "/auth/refresh",
  "/auth/me",
  "/auth/change-password",
  "/auth/logout",
]);

function throwAuthError(
  res: Response,
  data: { code?: string; message?: string },
): never {
  const code = data.code ?? "ERROR";
  throw new ApiError(
    res.status,
    code,
    getFriendlyErrorMessage(code, data.message ?? res.statusText),
  );
}

async function request<T>(
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: Body,
): Promise<T> {
  let res = await rawFetch(path, method, body);

  if (res.status === 401 && !NO_REFRESH.has(path) && !isLoggingOut()) {
    const refreshed = await rawFetch("/auth/refresh", "POST");
    if (refreshed.ok) {
      res = await rawFetch(path, method, body);
    } else {
      redirectSessionExpired();
      throwAuthError(refreshed, { code: "INVALID_REFRESH", message: "Session expired" });
    }
  }

  if (res.status === 401 && !NO_REFRESH.has(path) && !isLoggingOut()) {
    redirectSessionExpired();
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    throwAuthError(res, data);
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export const authApi = {
  signup: (input: {
    name: string;
    email: string;
    password: string;
    orgName: string;
  }) => request<void>("/auth/signup", "POST", input),

  verifyEmail: (token: string) =>
    request<void>("/auth/verify-email", "POST", { token }),

  login: (input: { email: string; password: string }) =>
    request<LoginResult>("/auth/login", "POST", input),

  // Public endpoint — revokes refresh when present and always clears cookies.
  logout: () => rawFetch("/auth/logout", "POST"),

  refresh: () => request<void>("/auth/refresh", "POST"),

  me: () => request<SessionUser>("/auth/me", "GET"),

  updateAccount: (input: { name: string }) =>
    request<SessionUser>("/auth/me", "PATCH", input),

  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    request<void>("/auth/change-password", "POST", input),

  forgotPassword: (email: string) =>
    request<void>("/auth/forgot-password", "POST", { email }),

  resetPassword: (input: { token: string; newPassword: string }) =>
    request<void>("/auth/reset-password", "POST", input),

  firstLoginResetPassword: (newPassword: string) =>
    request<void>("/auth/first-login/reset-password", "POST", { newPassword }),
};

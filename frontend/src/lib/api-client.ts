// Shared typed fetch for the NestJS app endpoints (/users, /projects, …).
// Mirrors auth-api.ts: sends the HTTP-only auth cookies (credentials:"include"),
// and on a 401 attempts one silent /auth/refresh then retries once, per the
// App Flow's silent-refresh rule. Errors surface as ApiError so callers can
// branch on status (409, 404) and the backend's `code` field.
import { getFriendlyErrorMessage } from "@/lib/error-messages";
import { redirectSessionExpired } from "@/lib/session-expired";
import { isLoggingOut } from "@/lib/session-state";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

// Endpoints where a 401 is meaningful and must NOT trigger refresh+retry.
const NO_REFRESH = new Set(["/auth/login", "/auth/refresh", "/auth/me"]);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** Extra fields the backend returns alongside code (e.g. assignedTasks, projects). */
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function rawFetch(
  path: string,
  method: Method,
  body?: unknown,
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function throwApiError(
  res: Response,
  data: { code?: string; message?: unknown; [key: string]: unknown },
): never {
  const code = data.code ?? "ERROR";
  const rawMessage =
    typeof data.message === "string" ? data.message : res.statusText;
  throw new ApiError(
    res.status,
    code,
    getFriendlyErrorMessage(code, rawMessage),
    data as Record<string, unknown>,
  );
}

export async function apiFetch<T>(
  path: string,
  method: Method = "GET",
  body?: unknown,
): Promise<T> {
  let res = await rawFetch(path, method, body);

  if (res.status === 401 && !NO_REFRESH.has(path) && !isLoggingOut()) {
    const refreshed = await rawFetch("/auth/refresh", "POST");
    if (refreshed.ok) {
      res = await rawFetch(path, method, body);
    } else {
      redirectSessionExpired();
      throwApiError(refreshed, { code: "INVALID_REFRESH", message: "Session expired" });
    }
  }

  if (res.status === 401 && !NO_REFRESH.has(path) && !isLoggingOut()) {
    redirectSessionExpired();
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: unknown;
      [key: string]: unknown;
    };
    throwApiError(res, data);
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

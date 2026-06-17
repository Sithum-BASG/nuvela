// Shared typed fetch for the NestJS app endpoints (/users, /projects, …).
// Mirrors auth-api.ts: sends the HTTP-only auth cookies (credentials:"include"),
// and on a 401 attempts one silent /auth/refresh then retries once, per the
// App Flow's silent-refresh rule. Errors surface as ApiError so callers can
// branch on status (409, 404) and the backend's `code` field.
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

export async function apiFetch<T>(
  path: string,
  method: Method = "GET",
  body?: unknown,
): Promise<T> {
  let res = await rawFetch(path, method, body);

  if (res.status === 401 && !NO_REFRESH.has(path)) {
    const refreshed = await rawFetch("/auth/refresh", "POST");
    if (refreshed.ok) {
      res = await rawFetch(path, method, body);
    }
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
      [key: string]: unknown;
    };
    throw new ApiError(
      res.status,
      data.code ?? "ERROR",
      data.message ?? res.statusText,
      data,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

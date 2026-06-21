import { ApiError } from "@/lib/api-client";

export type LoadErrorKind = "network" | "forbidden" | "not-found";

export function classifyLoadError(err: unknown): LoadErrorKind {
  if (err instanceof ApiError) {
    if (err.status === 404 || err.code === "NOT_FOUND") return "not-found";
    if (err.status === 403 || err.code === "FORBIDDEN") return "forbidden";
  }
  return "network";
}

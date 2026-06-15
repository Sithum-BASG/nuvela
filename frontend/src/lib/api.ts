// Base URL of the NestJS backend. Public (client-readable) by necessity.
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include", // send/receive the HTTP-only auth cookies (Phase 3)
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<{ status: string }> {
  return apiGet<{ status: string }>("/health");
}

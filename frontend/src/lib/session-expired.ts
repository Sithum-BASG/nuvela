/** Redirect to login when silent refresh fails (session truly expired). */
export function redirectSessionExpired(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname + window.location.search;
  const params = new URLSearchParams({ reason: "expired" });
  if (path && path !== "/login") {
    params.set("redirect", path);
  }
  window.location.assign(`/login?${params.toString()}`);
}

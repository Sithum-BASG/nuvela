// Client-only flag so silent refresh does not re-issue cookies mid-logout.
let loggingOut = false;

export function markLoggingOut(): void {
  loggingOut = true;
}

export function clearLoggingOut(): void {
  loggingOut = false;
}

export function isLoggingOut(): boolean {
  return loggingOut;
}

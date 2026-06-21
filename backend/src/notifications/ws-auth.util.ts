/** Parse `access_token` from a raw Cookie header (HTTP-only cookie per TRD). */
export function parseAccessTokenFromCookie(
  cookieHeader?: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const name = trimmed.slice(0, eqIndex);
    if (name === 'access_token') {
      const value = trimmed.slice(eqIndex + 1);
      return value.length > 0 ? value : null;
    }
  }

  return null;
}

// FRONTEND_URL drives CORS, WebSocket origins, and email deep links (TRD).
// Comma-separated values are supported so production can allow a custom domain
// plus the default Vercel hostname without redeploying when DNS changes.
const PRODUCTION_ORIGINS = ['https://nuvela.space', 'https://nuvela.vercel.app'];

export function parseFrontendOrigins(raw = process.env.FRONTEND_URL): string[] {
  const fromEnv = (raw ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    return [...new Set([...fromEnv, ...PRODUCTION_ORIGINS])];
  }

  return fromEnv;
}

export function primaryFrontendOrigin(): string {
  const origins = parseFrontendOrigins();
  const customDomain = origins.find((origin) => origin.includes('nuvela.space'));
  return customDomain ?? origins[0] ?? 'http://localhost:3000';
}

export function isAllowedFrontendOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  return parseFrontendOrigins().includes(origin);
}

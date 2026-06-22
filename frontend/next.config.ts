import type { NextConfig } from "next";

function backendOrigins(): { http: string; ws: string } {
  const raw = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  try {
    const url = new URL(raw);
    const http = url.origin;
    const ws =
      url.protocol === "https:"
        ? `wss://${url.host}`
        : `ws://${url.host}`;
    return { http, ws };
  } catch {
    return { http: "http://localhost:3001", ws: "ws://localhost:3001" };
  }
}

function buildContentSecurityPolicy(): string {
  const { http, ws } = backendOrigins();
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${http} ${ws} https://*.supabase.co`,
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join("; ");
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

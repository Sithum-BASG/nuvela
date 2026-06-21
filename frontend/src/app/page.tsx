"use client";

import { LogoLockup } from "@/components/logo";

// Splash (/): the auth provider handles all redirects from this route
// (authenticated → /dashboard, unauthenticated → /login). This page is purely
// a branded loading moment shown while the session resolves.
export default function SplashPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <LogoLockup className="motion-safe:animate-pulse motion-reduce:animate-none" />
    </main>
  );
}

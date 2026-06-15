"use client";

import { Loader2 } from "lucide-react";

import { LogoLockup } from "@/components/logo";

// Splash (/): the auth provider handles all redirects from this route
// (authenticated → /dashboard, unauthenticated → /login). This page is purely
// a branded loading moment shown while the session resolves.
export default function SplashPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background">
      <LogoLockup />
      <Loader2 className="size-5 animate-spin text-primary" aria-label="Loading" />
    </main>
  );
}

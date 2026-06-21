"use client";

import { useState } from "react";

import { useAuth } from "@/providers/auth-provider";
import { SocketProvider } from "@/providers/socket-provider";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { LogoSymbol } from "@/components/logo";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Full-screen splash while the session resolves (mirrors the auth splash).
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LogoSymbol className="size-12 motion-safe:animate-pulse motion-reduce:animate-none" />
      </div>
    );
  }

  // The AuthProvider redirects unauthenticated users to /login; render nothing
  // in the gap to avoid flashing the shell.
  if (status === "unauthenticated") return null;

  return (
    <SocketProvider>
      <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/30 transition-opacity duration-200 supports-backdrop-filter:backdrop-blur-xs motion-reduce:transition-none",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-64 bg-sidebar shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      </div>
    </SocketProvider>
  );
}

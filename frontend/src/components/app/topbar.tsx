"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Settings, LogOut } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/app/notification-bell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { initials, avatarColor } from "@/lib/avatar";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  COLLABORATOR: "Collaborator",
};

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-sidebar px-4 sm:px-6">
      <div className="flex flex-1 items-center gap-2">
        {/* Mobile sidebar trigger (hidden on lg, where the sidebar is always shown). */}
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </Button>
        )}
        <form onSubmit={onSearchSubmit} className="relative w-full max-w-[360px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search"
            className="h-11 pl-9"
          />
        </form>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />

        <ThemeToggle />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-9 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Account menu"
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-[13px] font-medium text-white",
                  avatarColor(user.name),
                )}
              >
                {initials(user.name)}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
                <span className="text-sm font-medium text-foreground">{user.name}</span>
                <span className="text-xs font-normal text-text-muted">
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings/account" />}>
                <Settings className="size-4" />
                Account settings
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

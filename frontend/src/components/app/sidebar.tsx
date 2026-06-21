"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Archive,
  Users,
  Building2,
  Bell,
  Search,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { LogoSymbol } from "@/components/logo";
import { cn } from "@/lib/utils";
import { initials, avatarColor } from "@/lib/avatar";

type NavLink = { href: string; label: string; icon: LucideIcon };

const DASHBOARD: NavLink = { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard };
const PROJECTS: NavLink = { href: "/projects", label: "Projects", icon: FolderKanban };
const ARCHIVED: NavLink = { href: "/projects/archived", label: "Archived", icon: Archive };
const USERS: NavLink = { href: "/users", label: "Users", icon: Users };
const ORG: NavLink = { href: "/settings/organization", label: "Organization", icon: Building2 };
const NOTIFICATIONS: NavLink = { href: "/notifications", label: "Notifications", icon: Bell };
const SEARCH: NavLink = { href: "/search", label: "Search", icon: Search };

// Role-aware navigation per App Flow §Navigation. Admin manages people, not
// projects; Collaborators see only their own work; Owner sees everything.
function linksFor(role: string): NavLink[] {
  switch (role) {
    case "OWNER":
      return [DASHBOARD, PROJECTS, ARCHIVED, USERS, ORG, NOTIFICATIONS, SEARCH];
    case "ADMIN":
      return [DASHBOARD, USERS, NOTIFICATIONS, SEARCH];
    case "PROJECT_MANAGER":
      return [DASHBOARD, PROJECTS, ARCHIVED, NOTIFICATIONS, SEARCH];
    default: // COLLABORATOR
      return [DASHBOARD, PROJECTS, NOTIFICATIONS, SEARCH];
  }
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  COLLABORATOR: "Collaborator",
};

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  const links = linksFor(user.role);

  function isActive(href: string): boolean {
    if (href === "/projects") {
      // Don't light up Projects while on the Archived sub-route.
      return pathname === "/projects" || (pathname.startsWith("/projects/") && !pathname.startsWith("/projects/archived"));
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-64 flex-col gap-1.5 bg-sidebar px-4 pb-4 pt-[22px]"
    >
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="mb-3 flex items-center gap-3 rounded-control pl-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <LogoSymbol className="size-9" />
        <span className="font-display text-[22px] font-semibold tracking-[-0.03em] text-sidebar-foreground">
          <span className="text-primary">N</span>uvela
        </span>
      </Link>

      {links.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "font-normal text-text-secondary hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
            {label}
          </Link>
        );
      })}

      <div className="flex-1" />

      <Link
        href="/settings/account"
        onClick={onNavigate}
        className="flex items-center gap-2.5 border-t border-sidebar-border pl-2 pt-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-white",
            avatarColor(user.name),
          )}
          aria-hidden
        >
          {initials(user.name)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-medium text-sidebar-foreground">
            {user.name}
          </span>
          <span className="truncate text-xs text-text-muted">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
        </span>
      </Link>
    </nav>
  );
}

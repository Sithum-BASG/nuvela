"use client";

import { PageHeader } from "@/components/app/page-header";
import { useAuth } from "@/providers/auth-provider";

// Role-aware dashboard landing. Real metric/project data is wired by the Users
// and Projects features (Tasks 7-8); this is the shared entry every role lands
// on after login. Owner/Admin get an org overview; PM/Collaborator get a
// work-focused greeting that points at their projects.
export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const firstName = user.name.split(/\s+/)[0];
  const isManagerial = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 sm:p-8">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle={
          isManagerial
            ? "Here's an overview of your workspace."
            : "Here's what's on your plate today."
        }
      />

      {isManagerial ? <ManagerialEmptyState role={user.role} /> : <MemberEmptyState />}
    </div>
  );
}

function ManagerialEmptyState({ role }: { role: string }) {
  // Owners manage projects + people; Admins manage people only — point each at
  // the part of the app they actually own.
  const cards =
    role === "OWNER"
      ? [
          { label: "Projects", href: "/projects", body: "Create and oversee every project in your organization." },
          { label: "Users", href: "/users", body: "Invite teammates and manage roles." },
          { label: "Organization", href: "/settings/organization", body: "Rename your org and manage admins." },
        ]
      : [
          { label: "Users", href: "/users", body: "Invite teammates and manage roles." },
        ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <a
          key={c.href}
          href={c.href}
          className="group flex flex-col gap-1.5 rounded-card border border-border bg-card p-5 outline-none transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="font-display text-base font-semibold text-foreground">{c.label}</span>
          <span className="text-[13px] leading-5 text-text-secondary">{c.body}</span>
        </a>
      ))}
    </div>
  );
}

function MemberEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <p className="font-display text-base font-semibold text-foreground">No projects yet</p>
      <p className="max-w-sm text-sm text-text-secondary">
        When you&apos;re added to a project, it&apos;ll show up here and in the Projects tab.
      </p>
      <a
        href="/projects"
        className="mt-1 text-sm font-medium text-accent-strong hover:underline"
      >
        Go to projects
      </a>
    </div>
  );
}

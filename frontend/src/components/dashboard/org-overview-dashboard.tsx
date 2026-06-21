"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, FolderKanban, UserPlus, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DashboardSkeleton,
  MetricCard,
  QuickActionCard,
  SectionHeader,
} from "@/components/dashboard/dashboard-shared";
import { avatarColor, initials } from "@/lib/avatar";
import { dashboardApi, type OrgOverview } from "@/lib/dashboard-api";
import { useSlowFetch } from "@/hooks/use-slow-fetch";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  COLLABORATOR: "Collaborator",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex h-[22px] items-center rounded-[6px] bg-success-tint px-2 text-[12px] leading-4 text-success">
        Active
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex h-[22px] items-center rounded-[6px] bg-warning-tint px-2 text-[12px] leading-4 text-warning">
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex h-[22px] items-center rounded-[6px] bg-surface-muted px-2 text-[12px] font-medium leading-4 text-text-muted">
      Deactivated
    </span>
  );
}

export function OrgOverviewDashboard({ role }: { role: string }) {
  const [data, setData] = useState<OrgOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const isOwner = role === "OWNER";

  const load = useCallback(async () => {
    try {
      const overview = await dashboardApi.orgOverview();
      setData(overview);
    } catch {
      toast.error("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const isSlow = useSlowFetch(loading);

  if (loading || !data) return <DashboardSkeleton isSlow={isSlow} />;

  const totalUsers =
    data.userCounts.OWNER +
    data.userCounts.ADMIN +
    data.userCounts.PROJECT_MANAGER +
    data.userCounts.COLLABORATOR;

  if (isOwner && data.projectCount === 0 && totalUsers <= 1) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Welcome to Nuvela"
        description="Create your first project, then invite teammates so you can add them to projects."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/projects" className={buttonVariants()}>
              Create project
            </Link>
            <Link href="/users" className={buttonVariants({ variant: "outline" })}>
              Invite teammate
            </Link>
          </div>
        }
      />
    );
  }

  if (!isOwner && totalUsers === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Add your team"
        description="Invite collaborators and project managers to get your organization started."
        action={
          <Link href="/users" className={buttonVariants()}>
            Invite users
          </Link>
        }
      />
    );
  }

  const metrics = isOwner
    ? [
        { label: "Active projects", value: data.projectCount, icon: FolderKanban },
        { label: "Team members", value: totalUsers, icon: Users },
        { label: "Pending invites", value: data.pendingInvites, icon: UserPlus },
        {
          label: "Collaborators",
          value: data.userCounts.COLLABORATOR,
          icon: Users,
        },
      ]
    : [
        { label: "Total users", value: totalUsers, icon: Users },
        { label: "Pending invites", value: data.pendingInvites, icon: UserPlus },
        {
          label: "Project managers",
          value: data.userCounts.PROJECT_MANAGER,
          icon: Users,
        },
        {
          label: "Collaborators",
          value: data.userCounts.COLLABORATOR,
          icon: Users,
        },
      ];

  const quickActions = isOwner
    ? [
        {
          label: "Projects",
          body: "Create and oversee every project in your organization.",
          href: "/projects",
          icon: FolderKanban,
        },
        {
          label: "Users",
          body: "Invite teammates and manage roles.",
          href: "/users",
          icon: Users,
        },
        {
          label: "Organization",
          body: "Rename your org and manage admins.",
          href: "/settings/organization",
          icon: Building2,
        },
      ]
    : [
        {
          label: "Users",
          body: "Invite teammates and manage roles.",
          href: "/users",
          icon: Users,
        },
      ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {isOwner && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((card) => (
            <QuickActionCard key={card.href} {...card} />
          ))}
        </div>
      )}

      {!isOwner && quickActions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((card) => (
            <QuickActionCard key={card.href} {...card} />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader title="Recent users" count={data.recentUsers.length} href="/users" />
        {data.recentUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users yet"
            description="Team members you invite will appear here."
            size="compact"
            className="rounded-card border border-dashed border-border bg-card/40 py-10"
          />
        ) : (
          <div className="overflow-hidden rounded-card border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[12px] font-medium uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.recentUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0 motion-safe:transition-colors hover:bg-surface-muted/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-white",
                            avatarColor(user.name),
                          )}
                        >
                          {initials(user.name)}
                        </span>
                        <span className="font-medium text-foreground">{user.name}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
                      {ROLE_LABEL[user.role] ?? user.role}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-text-muted md:table-cell">
                      {format(new Date(user.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

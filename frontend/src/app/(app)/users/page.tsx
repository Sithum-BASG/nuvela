"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, MoreHorizontal, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateUserModal } from "@/components/users/create-user-modal";
import { EditUserModal } from "@/components/users/edit-user-modal";
import { DeactivatePmTransferModal } from "@/components/users/deactivate-pm-transfer-modal";
import { useAuth } from "@/providers/auth-provider";
import {
  listUsers,
  deactivateUser,
  reactivateUser,
  resendInvite,
} from "@/lib/users-api";
import { ApiError } from "@/lib/api-client";
import { initials, avatarColor } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { OrgUser, ProjectStub, UserStatus } from "@/lib/users-api.types";
import { UsersTableSkeleton } from "@/components/ui/loading-states";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorCallout } from "@/components/ui/error-callout";
import { useSlowFetch } from "@/hooks/use-slow-fetch";
import { classifyLoadError, type LoadErrorKind } from "@/lib/load-error";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  COLLABORATOR: "Collaborator",
};

type StatusFilter = UserStatus | "ALL";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "DEACTIVATED", label: "Deactivated" },
];

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorKind | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<StatusFilter>>(new Set());

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OrgUser | null>(null);
  // Deactivate flow
  const [deactivateTarget, setDeactivateTarget] = useState<OrgUser | null>(null);
  const [transferProjects, setTransferProjects] = useState<ProjectStub[]>([]);

  const canManage = me?.role === "OWNER" || me?.role === "ADMIN";

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setLoadError(classifyLoadError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // --- filter logic ---
  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      activeFilters.size === 0 || activeFilters.has(u.status as StatusFilter);
    return matchesSearch && matchesStatus;
  });

  function toggleFilter(f: StatusFilter) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  function clearFilters() {
    setActiveFilters(new Set());
  }

  // --- actions ---
  async function handleResend(u: OrgUser) {
    try {
      await resendInvite(u.id);
      toast.success(`Invite resent to ${u.email}`);
    } catch {
      toast.error("Failed to resend invite.");
    }
  }

  async function handleDeactivate(u: OrgUser) {
    try {
      const result = await deactivateUser(u.id);
      if (result.done) {
        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: "DEACTIVATED" } : x)));
        toast.success(`${u.name} has been deactivated`);
      } else {
        // Has PM projects that need reassignment
        setDeactivateTarget(u);
        setTransferProjects(result.projects ?? []);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error("You don't have permission to deactivate this user.");
      } else {
        toast.error("Failed to deactivate user.");
      }
    }
  }

  async function handleReactivate(u: OrgUser) {
    try {
      const updated = await reactivateUser(u.id);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
      toast.success(`${u.name} has been reactivated`);
    } catch {
      toast.error("Failed to reactivate user.");
    }
  }

  // Available PMs for transfer (active PMs, excluding the target)
  const availablePMs = users.filter(
    (u) =>
      u.status === "ACTIVE" &&
      u.role === "PROJECT_MANAGER" &&
      u.id !== deactivateTarget?.id,
  );

  const isSlow = useSlowFetch(loading);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:gap-5 sm:p-8">
      <PageHeader
        title="Users"
        subtitle="Manage who has access to your organization"
        action={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>Add user</Button>
          ) : undefined
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative w-full lg:w-[360px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="pl-9"
            aria-label="Search users"
          />
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-text-muted">Filter</span>
          {STATUS_FILTERS.map((f) => {
            const active = activeFilters.has(f.value);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => toggleFilter(f.value)}
                className={cn(
                  "flex h-[30px] items-center gap-2 rounded-[8px] border px-[11px] text-[13px] transition-colors",
                  active
                    ? "border-accent-tint bg-accent-tint font-medium text-accent-strong"
                    : "border-border bg-card font-normal text-text-secondary hover:border-border/80",
                )}
              >
                {f.label}
                {active && (
                  <span className="flex size-3 items-center justify-center text-accent-strong" aria-hidden>
                    ×
                  </span>
                )}
              </button>
            );
          })}
          {activeFilters.size > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[13px] font-medium text-accent-strong hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[12px] border border-border bg-card">
        {/* Header row */}
        <div className="hidden h-[38px] items-center border-b border-border bg-muted px-5 md:flex">
          <div className="flex flex-1 items-center">
            <span className="text-[12px] font-medium tracking-[0.48px] text-text-muted uppercase">
              User
            </span>
          </div>
          <div className="w-[140px]">
            <span className="text-[12px] font-medium tracking-[0.48px] text-text-muted uppercase">
              Role
            </span>
          </div>
          <div className="w-[130px]">
            <span className="text-[12px] font-medium tracking-[0.48px] text-text-muted uppercase">
              Status
            </span>
          </div>
          <div className="w-[90px]" />
        </div>

        {loading && <UsersTableSkeleton isSlow={isSlow} />}

        {!loading && loadError && (
          <div className="px-5 py-6">
            <ErrorCallout variant={loadError} onRetry={() => void load()} />
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="px-6 py-8">
            <EmptyState
              icon={Users}
              title={search || activeFilters.size > 0 ? "No matching users" : "No users yet"}
              description={
                search || activeFilters.size > 0
                  ? "Try adjusting your search or filters."
                  : canManage
                    ? "Create your first team member to get started."
                    : "Users will appear here once added."
              }
              action={
                canManage && !search && activeFilters.size === 0 ? (
                  <Button onClick={() => setCreateOpen(true)}>Add user</Button>
                ) : undefined
              }
              size="compact"
              className="border-0 bg-transparent py-6"
            />
          </div>
        )}

        {/* Data rows */}
        {!loading &&
          !loadError &&
          filtered.map((u) => {
            const isDeactivated = u.status === "DEACTIVATED";
            const isPending = u.status === "PENDING";
            const isSelf = u.id === me?.id;

            return (
              <div
                key={u.id}
                className={cn(
                  "flex flex-col gap-3 border-b border-border bg-card p-4 last:border-b-0",
                  "md:h-[64px] md:flex-row md:items-center md:px-5 md:py-[14px]",
                )}
              >
                {/* User cell */}
                <div className="flex flex-1 items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-white",
                      avatarColor(u.name),
                      isDeactivated && "opacity-55",
                    )}
                    aria-hidden
                  >
                    {initials(u.name)}
                  </span>
                  <div className={cn("flex flex-col gap-px", isDeactivated && "text-text-muted")}>
                    <span className={cn("text-[14px] font-medium", !isDeactivated && "text-foreground")}>
                      {u.name}
                    </span>
                    <span className="text-[12px] text-text-muted">{u.email}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 md:contents">
                  {/* Role cell */}
                  <div className="md:w-[140px]">
                  <span
                    className={cn(
                      "text-[14px]",
                      isDeactivated ? "text-text-muted" : "text-text-secondary",
                    )}
                  >
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                  </div>

                  {/* Status cell */}
                  <div className="md:w-[130px]">
                  <StatusBadge status={u.status} />
                  </div>

                  {/* Actions cell */}
                  <div className="flex min-h-11 items-center justify-end gap-[10px] md:w-[90px]">
                  {isPending && canManage && (
                    <button
                      type="button"
                      onClick={() => void handleResend(u)}
                      className="text-[13px] font-medium text-accent-strong hover:underline"
                    >
                      Resend
                    </button>
                  )}
                  {canManage && !isSelf && u.role !== "OWNER" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="flex size-11 items-center justify-center rounded-[6px] text-text-muted outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none md:size-7"
                        aria-label={`Actions for ${u.name}`}
                      >
                        <MoreHorizontal className="size-[18px]" strokeWidth={1.75} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setEditTarget(u)}>
                          Edit user
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {isDeactivated ? (
                          <DropdownMenuItem onClick={() => void handleReactivate(u)}>
                            Reactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => void handleDeactivate(u)}
                          >
                            Deactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Modals */}
      <CreateUserModal
        open={createOpen}
        actorRole={me?.role}
        onClose={() => setCreateOpen(false)}
        onCreated={(u) => setUsers((prev) => [...prev, u])}
      />
      <EditUserModal
        user={editTarget}
        actorRole={me?.role}
        onClose={() => setEditTarget(null)}
        onUpdated={(u) => setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
      />
      <DeactivatePmTransferModal
        user={deactivateTarget}
        projects={transferProjects}
        availablePMs={availablePMs}
        onClose={() => {
          setDeactivateTarget(null);
          setTransferProjects([]);
        }}
        onDeactivated={(id) =>
          setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, status: "DEACTIVATED" } : x)))
        }
      />
    </div>
  );
}

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
    <span className="inline-flex h-[22px] items-center rounded-[6px] bg-muted px-2 text-[12px] font-medium leading-4 text-text-muted">
      Deactivated
    </span>
  );
}

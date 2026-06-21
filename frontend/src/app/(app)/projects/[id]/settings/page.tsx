"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RemoveMemberDialog } from "@/components/projects/remove-member-dialog";
import { MemberListSkeleton, ProjectSettingsSkeleton } from "@/components/ui/loading-states";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/providers/auth-provider";
import { projectsApi } from "@/lib/projects-api";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS } from "@/lib/project-colors";
import { initials, avatarColor } from "@/lib/avatar";
import type { ProjectRow, MemberRow, UpdateProjectInput } from "@/lib/projects-api.types";

// Project settings page (Figma node 1015:3983).
// Tabs: General | Members | Labels | Danger Zone
// Access: owning PM (managerId === me.id) or Owner only — others redirect to board.
// Archived projects: General fields are read-only; Danger Zone shows Unarchive.

type Tab = "general" | "members" | "labels" | "danger";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  COLLABORATOR: "Collaborator",
};

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user: me } = useAuth();

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [directory, setDirectory] = useState<
    { id: string; name: string; email: string; role: string }[]
  >([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [tab, setTab] = useState<Tab>("general");

  // General form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [saving, setSaving] = useState(false);

  // Remove member dialog
  const [removingMember, setRemovingMember] = useState<MemberRow | null>(null);

  // Add member: search + adding state
  const [addSearch, setAddSearch] = useState("");
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  // Danger zone
  const [transferTo, setTransferTo] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // ── Load project ──────────────────────────────────────────────────────────
  const loadProject = useCallback(async () => {
    setLoadingProject(true);
    try {
      const data = await projectsApi.get(id);
      setProject(data);
      setName(data.name);
      setDescription(data.description ?? "");
      setColor(data.color);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        router.replace("/projects");
      } else {
        toast.error("Failed to load project.");
      }
    } finally {
      setLoadingProject(false);
    }
  }, [id, router]);

  useEffect(() => {
    void (async () => { await loadProject(); })();
  }, [loadProject]);

  // RBAC guard: only owning PM or Owner may access settings.
  // Wait until both project + me are loaded before redirecting.
  useEffect(() => {
    if (!project || !me) return;
    const canAccess =
      me.role === "OWNER" ||
      (me.role === "PROJECT_MANAGER" && project.managerId === me.id);
    if (!canAccess) {
      router.replace(`/projects/${id}`);
    }
  }, [project, me, id, router]);

  // ── Load members when Members tab is active ───────────────────────────────
  useEffect(() => {
    if (tab !== "members" || !id) return;

    async function loadMembers() {
      setLoadingMembers(true);
      try {
        const [memberList, dir] = await Promise.all([
          projectsApi.members.list(id),
          projectsApi.members.inviteDirectory(id, addSearch || undefined),
        ]);
        setMembers(memberList);
        setDirectory(dir);
      } catch {
        toast.error("Failed to load members.");
      } finally {
        setLoadingMembers(false);
      }
    }

    void loadMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  // Refresh invite directory when search changes
  useEffect(() => {
    if (tab !== "members") return;
    const t = setTimeout(async () => {
      try {
        const dir = await projectsApi.members.inviteDirectory(id, addSearch || undefined);
        setDirectory(dir);
      } catch {
        // silent — don't disrupt the page for a search failure
      }
    }, 300);
    return () => clearTimeout(t);
  }, [addSearch, tab, id]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required.");
      return;
    }
    setSaving(true);
    try {
      const input: UpdateProjectInput = {};
      if (name.trim() !== project?.name) input.name = name.trim();
      if ((description.trim() || undefined) !== (project?.description ?? undefined))
        input.description = description.trim() || undefined;
      if (color !== project?.color) input.color = color;

      if (Object.keys(input).length === 0) {
        toast.info("No changes to save.");
        return;
      }
      const updated = await projectsApi.update(id, input);
      setProject(updated);
      toast.success("Project updated.");
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(userId: string) {
    setAddingMemberId(userId);
    try {
      const member = await projectsApi.members.add(id, { userId });
      setMembers((prev) => [...prev, member]);
      setDirectory((prev) => prev.filter((u) => u.id !== userId));
      toast.success("Member added.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("This person is already a member.");
      } else {
        toast.error("Failed to add member.");
      }
    } finally {
      setAddingMemberId(null);
    }
  }

  function handleMemberRemoved(userId: string) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    setRemovingMember(null);
    toast.success("Member removed.");
  }

  async function handleArchiveToggle() {
    if (!project) return;
    setArchiving(true);
    try {
      if (project.status === "ARCHIVED") {
        await projectsApi.unarchive(id);
        setProject((p) => p && { ...p, status: "ACTIVE" });
        toast.success("Project restored.");
      } else {
        await projectsApi.archive(id);
        setProject((p) => p && { ...p, status: "ARCHIVED" });
        toast.success("Project archived.");
      }
    } catch {
      toast.error("Failed to update project status.");
    } finally {
      setArchiving(false);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferTo) return;
    setTransferring(true);
    try {
      const updated = await projectsApi.transfer(id, { newManagerId: transferTo });
      setProject(updated);
      setTransferTo("");
      toast.success("Ownership transferred.");
    } catch {
      toast.error("Failed to transfer ownership.");
    } finally {
      setTransferring(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loadingProject) {
    return <ProjectSettingsSkeleton />;
  }

  if (!project) return null;

  const archived = project.status === "ARCHIVED";

  // Members not already in the project (directory is already filtered server-side
  // but the backend may return everyone — filter client-side to be safe).
  const memberUserIds = new Set(members.map((m) => m.userId));
  const invitable = directory.filter((u) => !memberUserIds.has(u.id));
  const orgHasOtherUsers = directory.some((u) => u.id !== me?.id);

  // Transfer targets: org members who are PM or Owner (exclude self)
  const transferCandidates = directory.filter(
    (u) =>
      u.id !== me?.id &&
      (u.role === "PROJECT_MANAGER" || u.role === "OWNER"),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      {/* Back link — Figma "back" row (node 1015:4128) */}
      <button
        type="button"
        onClick={() => router.push(`/projects/${id}`)}
        className="flex w-fit items-center gap-2 rounded-[8px] px-2 py-1.5 text-[14px] font-medium text-text-secondary outline-none transition-colors hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-white/10 motion-reduce:transition-none"
      >
        <ArrowLeft className="size-[16px]" strokeWidth={1.75} aria-hidden />
        Projects
      </button>

      {/* Title row — swatch + name + status badge (node 1015:4129) */}
      <div className="flex items-center gap-3">
        <span
          className="size-[28px] shrink-0 rounded-[8px]"
          style={{ backgroundColor: project.color }}
          aria-hidden
        />
        <h1 className="font-display text-[24px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {project.name}
        </h1>
        {archived ? (
          <span className="inline-flex h-[22px] items-center rounded-[6px] bg-warning-tint px-2 text-[12px] leading-4 text-warning">
            Archived
          </span>
        ) : (
          <span className="inline-flex h-[22px] items-center rounded-[6px] bg-success-tint px-2 text-[12px] leading-4 text-success">
            Active
          </span>
        )}
      </div>

      {/* Tab bar (Figma node 1015:4134) */}
      <div
        role="tablist"
        className="flex gap-6 border-b border-border pl-0.5"
        aria-label="Settings sections"
      >
        {(
          [
            { key: "general", label: "General" },
            { key: "members", label: "Members" },
            { key: "labels", label: "Labels" },
            { key: "danger", label: "Danger Zone" },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={cn(
                "flex flex-col items-center gap-[10px] pb-0 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none",
                active ? "text-foreground" : "text-text-secondary hover:text-foreground",
              )}
            >
              <span className={cn("text-[14px]", active ? "font-medium" : "font-normal")}>
                {label}
              </span>
              {/* active indicator underline */}
              <span
                className={cn(
                  "h-[2px] w-full rounded-full transition-colors motion-reduce:transition-none",
                  active ? "bg-accent" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      {/* ── General tab ──────────────────────────────────────────────────── */}
      {tab === "general" && (
        <form onSubmit={handleSaveGeneral} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor="ps-name" className="text-[13px] font-medium text-foreground">
              Project name
            </Label>
            <Input
              id="ps-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              disabled={archived}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-[7px]">
            <Label htmlFor="ps-desc" className="text-[13px] font-medium text-foreground">
              Description
            </Label>
            <textarea
              id="ps-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description…"
              rows={3}
              disabled={archived}
              className="min-h-[88px] w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            />
          </div>

          <div className="flex flex-col gap-[7px]">
            <Label className="text-[13px] font-medium text-foreground">Color</Label>
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Project color">
              {PROJECT_COLORS.map((c) => {
                const selected = c.value === color;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={c.name}
                    disabled={archived}
                    onClick={() => setColor(c.value)}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
                      selected && "ring-2 ring-offset-2 ring-offset-background",
                    )}
                    style={
                      selected
                        ? ({ "--tw-ring-color": c.value } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <span
                      className="size-[26px] rounded-full"
                      style={{ backgroundColor: c.value }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {!archived && (
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>
                <ButtonPendingLabel pending={saving} label="Save changes" pendingLabel="Saving…" />
              </Button>
            </div>
          )}
          {archived && (
            <p className="text-[13px] text-text-muted">
              Unarchive this project to edit its settings.
            </p>
          )}
        </form>
      )}

      {/* ── Members tab ──────────────────────────────────────────────────── */}
      {tab === "members" && (
        <div className="flex flex-col gap-6">
          {/* Current members */}
          <section aria-labelledby="members-heading">
            <h2
              id="members-heading"
              className="mb-3 font-display text-[16px] font-semibold text-foreground"
            >
              Project members
            </h2>

            {loadingMembers ? (
              <MemberListSkeleton />
            ) : members.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="No collaborators invited yet"
                description="Invite teammates from your organization to collaborate on this project."
                size="compact"
                className="rounded-[12px] border border-border bg-card py-8"
              />
            ) : (
              <div className="flex flex-col gap-1 rounded-[12px] border border-border bg-card p-2">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    // Figma "Project Member List Item" node 480:1120:
                    // h-60px, gap-12px, pl-14px pr-10px
                    className="flex h-[60px] items-center gap-3 rounded-[10px] border border-border bg-background pl-[14px] pr-[10px]"
                  >
                    {/* Avatar with initials */}
                    <span
                      className={cn(
                        "flex size-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-medium text-white",
                        avatarColor(member.name),
                      )}
                      aria-hidden
                    >
                      {initials(member.name)}
                    </span>

                    {/* Name + email */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[14px] font-medium text-foreground">
                        {member.name}
                      </span>
                      <span className="truncate text-[12px] text-text-muted">
                        {member.email}
                      </span>
                    </div>

                    {/* Role badge — accent-tint per Figma (node I1015:4153;480:1112) */}
                    <span className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-accent-tint px-2 text-[12px] leading-4 text-accent-strong">
                      {ROLE_LABEL[member.role] ?? member.role}
                    </span>

                    {/* Remove button — icon button (Figma manage icon) */}
                    <button
                      type="button"
                      aria-label={`Remove ${member.name}`}
                      onClick={() => setRemovingMember(member)}
                      className="flex size-[36px] shrink-0 items-center justify-center rounded-[8px] text-text-muted outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                    >
                      <UserMinus className="size-[16px]" strokeWidth={1.75} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Invite from org */}
          <section aria-labelledby="invite-heading">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2
                id="invite-heading"
                className="font-display text-[16px] font-semibold text-foreground"
              >
                Invite from your organization
              </h2>
              <Input
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="h-9 w-56 text-[13px]"
                aria-label="Search organization members"
              />
            </div>

            {invitable.length === 0 ? (
              addSearch ? (
                <EmptyState
                  icon={UserPlus}
                  title="No matches found"
                  description="Try a different name or email."
                  size="compact"
                  className="rounded-[12px] border border-border bg-card py-8"
                />
              ) : !orgHasOtherUsers ? (
                <EmptyState
                  icon={UserPlus}
                  title="Add team members first"
                  description="Users must exist in your organization before you can invite them to a project. Create teammates at Users, then return here."
                  action={
                    <Button variant="outline" size="sm" onClick={() => router.push("/users")}>
                      Go to Users
                    </Button>
                  }
                  size="compact"
                  className="rounded-[12px] border border-border bg-card py-8"
                />
              ) : (
                <EmptyState
                  icon={UserPlus}
                  title="Everyone is already a member"
                  description="All users in your organization are on this project."
                  size="compact"
                  className="rounded-[12px] border border-border bg-card py-8"
                />
              )
            ) : (
              <div className="flex flex-col gap-1 rounded-[12px] border border-border bg-card p-2">
                {invitable.map((user) => (
                  <div
                    key={user.id}
                    className="flex h-[60px] items-center gap-3 rounded-[10px] border border-border bg-background pl-[14px] pr-3"
                  >
                    <span
                      className={cn(
                        "flex size-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-medium text-white",
                        avatarColor(user.name),
                      )}
                      aria-hidden
                    >
                      {initials(user.name)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[14px] font-medium text-foreground">
                        {user.name}
                      </span>
                      <span className="truncate text-[12px] text-text-muted">
                        {user.email} · {ROLE_LABEL[user.role] ?? user.role}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 text-[13px]"
                      disabled={addingMemberId === user.id}
                      onClick={() => handleAddMember(user.id)}
                    >
                      <UserPlus className="size-[14px]" strokeWidth={1.75} aria-hidden />
                      <ButtonPendingLabel
                        pending={addingMemberId === user.id}
                        label="Invite"
                        pendingLabel="Adding…"
                      />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Labels tab ───────────────────────────────────────────────────── */}
      {tab === "labels" && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="font-display text-[15px] font-semibold text-foreground">
            Label management coming soon
          </p>
          <p className="max-w-sm text-[13px] text-text-secondary">
            Custom labels for tasks in this project will be configurable here in a future update.
          </p>
        </div>
      )}

      {/* ── Danger Zone tab ──────────────────────────────────────────────── */}
      {tab === "danger" && (
        <div className="flex flex-col gap-8">
          {/* Archive / Unarchive */}
          <section
            aria-labelledby="archive-heading"
            className="rounded-[12px] border border-destructive/30 bg-card p-5"
          >
            <h2
              id="archive-heading"
              className="mb-1 font-display text-[15px] font-semibold text-foreground"
            >
              {archived ? "Restore project" : "Archive project"}
            </h2>
            <p className="mb-4 text-[13px] text-text-secondary">
              {archived
                ? "Restoring makes this project active again. Members regain access and tasks become editable."
                : "Archiving makes this project read-only. Members can still view it but cannot create or edit tasks."}
            </p>
            <Button
              variant={archived ? "outline" : "destructive"}
              onClick={handleArchiveToggle}
              disabled={archiving}
            >
              {archiving
                ? archived
                  ? "Restoring…"
                  : "Archiving…"
                : archived
                  ? "Restore project"
                  : "Archive project"}
            </Button>
          </section>

          {/* Transfer ownership — active projects only */}
          {!archived && (
            <section
              aria-labelledby="transfer-heading"
              className="rounded-[12px] border border-destructive/30 bg-card p-5"
            >
              <h2
                id="transfer-heading"
                className="mb-1 font-display text-[15px] font-semibold text-foreground"
              >
                Transfer ownership
              </h2>
              <p className="mb-4 text-[13px] text-text-secondary">
                Assign a new Project Manager for this project. You will lose management access
                unless you are an Owner.
              </p>
              <form onSubmit={handleTransfer} className="flex items-end gap-3">
                <div className="flex flex-1 flex-col gap-[7px]">
                  <Label
                    htmlFor="ps-transfer"
                    className="text-[13px] font-medium text-foreground"
                  >
                    New manager
                  </Label>
                  <select
                    id="ps-transfer"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    <option value="">Select a project manager…</option>
                    {transferCandidates.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {ROLE_LABEL[u.role] ?? u.role}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!transferTo || transferring}
                  className="shrink-0"
                >
                  <ButtonPendingLabel
                    pending={transferring}
                    label="Transfer"
                    pendingLabel="Transferring…"
                  />
                </Button>
              </form>
            </section>
          )}
        </div>
      )}

      {/* Remove member dialog */}
      {removingMember && (
        <RemoveMemberDialog
          open
          projectId={id}
          member={removingMember}
          remainingMembers={members.filter((m) => m.userId !== removingMember.userId)}
          onClose={() => setRemovingMember(null)}
          onRemoved={() => handleMemberRemoved(removingMember.userId)}
        />
      )}
    </div>
  );
}

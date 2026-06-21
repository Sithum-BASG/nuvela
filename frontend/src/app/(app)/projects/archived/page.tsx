"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, ArchiveRestore, Archive } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/providers/auth-provider";
import { projectsApi } from "@/lib/projects-api";
import type { ProjectRow } from "@/lib/projects-api.types";
import { ArchivedProjectsListSkeleton } from "@/components/ui/loading-states";

// Archived projects page (Figma node 1025:4538).
// Read-only — no create, no edit. Owning PM / Owner may unarchive.
// Archived badge uses warning-tint (amber) per Figma, distinct from the grey
// "Archived" badge on the active list which uses a neutral fill.

export default function ArchivedProjectsPage() {
  const router = useRouter();
  const { user: me } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unarchiving, setUnarchiving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectsApi.listArchived();
      setProjects(data);
    } catch {
      toast.error("Failed to load archived projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  // Owning PM / Owner may restore.
  function canManage(project: ProjectRow) {
    return (
      me?.role === "OWNER" ||
      (me?.role === "PROJECT_MANAGER" && project.managerId === me.id)
    );
  }

  async function handleUnarchive(project: ProjectRow) {
    setUnarchiving(project.id);
    try {
      await projectsApi.unarchive(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success(`${project.name} restored`);
    } catch {
      toast.error("Failed to restore project.");
    } finally {
      setUnarchiving(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-8">
      <PageHeader
        title="Archived projects"
        subtitle="Read-only. Restore a project to make it active again."
      />

      {loading && <ArchivedProjectsListSkeleton />}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <EmptyState
          icon={Archive}
          title="No archived projects"
          description="Projects you archive will appear here as read-only records."
          action={
            <Button variant="outline" onClick={() => router.push("/projects")}>
              Back to projects
            </Button>
          }
        />
      )}

      {/* Archived project rows */}
      {!loading && projects.length > 0 && (
        <div className="flex flex-col gap-[10px] rounded-[12px] border border-border bg-card p-[10px]">
          {projects.map((project) => {
            const archivedDate = new Date(project.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={project.id}
                // Figma row: h-[64px], gap-[14px], pl-[16px] pr-[12px]
                className="flex h-[64px] items-center gap-[14px] rounded-[12px] border border-border bg-card pl-4 pr-3 py-3"
              >
                {/* Color swatch — project.color is hex (content color, not theme token) */}
                <span
                  className="h-[36px] w-[10px] shrink-0 rounded-[3px] opacity-60"
                  style={{ backgroundColor: project.color }}
                  aria-hidden
                />

                {/* Name + archived meta */}
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="truncate text-[14px] font-medium text-text-secondary">
                    {project.name}
                  </span>
                  <span className="truncate text-[12px] leading-4 text-text-muted">
                    Archived {archivedDate} · read-only
                  </span>
                </div>

                {/* Member count */}
                <div className="flex shrink-0 items-center gap-[5px] text-text-muted">
                  <Users className="size-[14px]" strokeWidth={1.75} aria-hidden />
                  <span className="text-[13px]">{project.memberCount}</span>
                </div>

                {/* Archived badge — warning-tint per Figma (node I449:993) */}
                <span className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-warning-tint px-2 text-[12px] leading-4 text-warning">
                  Archived
                </span>

                {/* Unarchive — owning PM / Owner only */}
                {canManage(project) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1.5 text-[13px] text-text-secondary hover:text-foreground"
                    disabled={unarchiving === project.id}
                    onClick={() => handleUnarchive(project)}
                  >
                    <ArchiveRestore className="size-[14px]" strokeWidth={1.75} aria-hidden />
                    <ButtonPendingLabel
                      pending={unarchiving === project.id}
                      label="Unarchive"
                      pendingLabel="Restoring…"
                    />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

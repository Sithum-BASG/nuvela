"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { useAuth } from "@/providers/auth-provider";
import { projectsApi } from "@/lib/projects-api";
import type { ProjectRow } from "@/lib/projects-api.types";

export default function ProjectsPage() {
  const { user: me } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // PM and Owner create projects; Admin sees an empty list (API returns []).
  const canCreate = me?.role === "PROJECT_MANAGER" || me?.role === "OWNER";

  const load = useCallback(async () => {
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch {
      toast.error("Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function handleArchive(project: ProjectRow) {
    try {
      await projectsApi.archive(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success(`${project.name} archived`);
    } catch {
      toast.error("Failed to archive project.");
    }
  }

  // Owning PM / Owner may manage a project's row actions.
  function canManage(project: ProjectRow) {
    return me?.role === "OWNER" || (me?.role === "PROJECT_MANAGER" && project.managerId === me.id);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-8">
      <PageHeader
        title="Projects"
        subtitle="Your projects and their progress"
        action={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>New project</Button>
          ) : undefined
        }
      />

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-[10px] rounded-[12px] border border-border bg-card p-[10px]">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex h-[68px] items-center gap-[14px] rounded-[12px] border border-border px-4 py-3"
            >
              <div className="h-[38px] w-[10px] shrink-0 animate-pulse rounded-[3px] bg-border" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-40 animate-pulse rounded bg-border" />
                <div className="h-2.5 w-56 animate-pulse rounded bg-border" />
              </div>
              <div className="h-[22px] w-14 animate-pulse rounded-[6px] bg-border" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-[12px] border border-border bg-card px-6 py-16 text-center">
          <p className="font-display text-[15px] font-semibold text-foreground">No projects yet</p>
          <p className="max-w-sm text-[13px] text-text-secondary">
            {canCreate
              ? "Create your first project to get started."
              : "Projects you're a member of will appear here."}
          </p>
          {canCreate && (
            <Button className="mt-2" onClick={() => setCreateOpen(true)}>
              New project
            </Button>
          )}
        </div>
      )}

      {/* Project rows */}
      {!loading && projects.length > 0 && (
        <div className="flex flex-col gap-[10px] rounded-[12px] border border-border bg-card p-[10px]">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canManage={canManage(project)}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(p) => setProjects((prev) => [p, ...prev])}
      />
    </div>
  );
}

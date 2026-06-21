"use client";

import { useState, useEffect, useCallback } from "react";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { useAuth } from "@/providers/auth-provider";
import { projectsApi } from "@/lib/projects-api";
import type { ProjectRow } from "@/lib/projects-api.types";
import { ProjectsListSkeleton } from "@/components/ui/loading-states";
import { ErrorCallout } from "@/components/ui/error-callout";
import { useSlowFetch } from "@/hooks/use-slow-fetch";
import { classifyLoadError, type LoadErrorKind } from "@/lib/load-error";

export default function ProjectsPage() {
  const { user: me } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorKind | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // PM and Owner create projects; Admin sees an empty list (API returns []).
  const canCreate = me?.role === "PROJECT_MANAGER" || me?.role === "OWNER";

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await projectsApi.list();
      setProjects(data);
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

  const isSlow = useSlowFetch(loading);

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

      {loading && <ProjectsListSkeleton isSlow={isSlow} />}

      {!loading && loadError && (
        <ErrorCallout variant={loadError} onRetry={() => void load()} />
      )}

      {!loading && !loadError && projects.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={
            canCreate
              ? "Create your first project to get started. Add team members at Users before inviting them to a project."
              : "Projects you're a member of will appear here."
          }
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>New project</Button>
            ) : undefined
          }
        />
      )}

      {/* Project rows */}
      {!loading && !loadError && projects.length > 0 && (
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

"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { projectsApi } from "@/lib/projects-api";
import type { ProjectRow } from "@/lib/projects-api.types";
import { KanbanBoard } from "@/components/board/kanban-board";
import { BoardPageSkeleton } from "@/components/ui/loading-states";
import { ErrorCallout } from "@/components/ui/error-callout";
import { useSlowFetch } from "@/hooks/use-slow-fetch";
import { classifyLoadError, type LoadErrorKind } from "@/lib/load-error";

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialTaskId = searchParams.get("task");
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorKind | null>(null);

  useEffect(() => {
    void (async () => {
      setLoadError(null);
      setLoading(true);
      try {
        const p = await projectsApi.get(id);
        setProject(p);
      } catch (err) {
        setLoadError(classifyLoadError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const isSlow = useSlowFetch(loading);

  if (loading) {
    return <BoardPageSkeleton isSlow={isSlow} />;
  }

  if (loadError) {
    return (
      <div className="p-6 sm:p-8">
        <ErrorCallout variant={loadError} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex h-full flex-col p-6 sm:p-8">
      <KanbanBoard
        projectId={project.id}
        projectManagerId={project.managerId}
        projectName={project.name}
        projectDescription={project.description}
        initialTaskId={initialTaskId}
      />
    </div>
  );
}

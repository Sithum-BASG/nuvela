"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { projectsApi } from "@/lib/projects-api";
import type { ProjectRow } from "@/lib/projects-api.types";
import { KanbanBoard } from "@/components/board/kanban-board";
import { PageHeader } from "@/components/app/page-header";
import { BoardPageSkeleton } from "@/components/ui/loading-states";
import { useSlowFetch } from "@/hooks/use-slow-fetch";

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialTaskId = searchParams.get("task");
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const p = await projectsApi.get(id);
        setProject(p);
      } catch {
        toast.error("Failed to load project.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const isSlow = useSlowFetch(loading);

  if (loading) {
    return <BoardPageSkeleton isSlow={isSlow} />;
  }

  if (!project) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-6 pt-6 pb-3">
        <PageHeader
          title={project.name}
          subtitle={project.description ?? undefined}
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          projectId={project.id}
          projectManagerId={project.managerId}
          initialTaskId={initialTaskId}
        />
      </div>
    </div>
  );
}

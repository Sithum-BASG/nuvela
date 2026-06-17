"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { projectsApi } from "@/lib/projects-api";
import type { ProjectRow } from "@/lib/projects-api.types";
import { KanbanBoard } from "@/components/board/kanban-board";
import { PageHeader } from "@/components/app/page-header";

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>();
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

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-6 pt-6 pb-4">
          <div className="h-5 w-40 animate-pulse rounded bg-border" />
        </div>
        <div className="flex flex-1 gap-3 overflow-x-auto px-6 pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex w-[272px] shrink-0 flex-col gap-2 rounded-[12px] border border-border bg-card p-3"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-border" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-[76px] animate-pulse rounded-[8px] bg-border" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
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
        />
      </div>
    </div>
  );
}

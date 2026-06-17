"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Settings, KanbanSquare } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { projectsApi } from "@/lib/projects-api";
import { ApiError } from "@/lib/api-client";
import type { ProjectRow } from "@/lib/projects-api.types";

// Board placeholder — the Kanban board itself lands in Phase 5. For now this
// resolves the project (name + color) and links the owning PM / Owner to settings.
export default function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user: me } = useAuth();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await projectsApi.get(id);
      setProject(data);
    } catch (err) {
      // 404 hides cross-tenant / non-member existence (RBAC invariant).
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        toast.error("Failed to load project.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const canManage =
    !!project &&
    (me?.role === "OWNER" ||
      (me?.role === "PROJECT_MANAGER" && project.managerId === me.id));

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-8">
        <div className="flex items-center gap-3">
          <div className="h-7 w-1.5 animate-pulse rounded bg-border" />
          <div className="h-7 w-48 animate-pulse rounded bg-border" />
        </div>
        <div className="h-64 animate-pulse rounded-[12px] border border-border bg-card" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-3 p-8 py-24 text-center">
        <p className="font-display text-[18px] font-semibold text-foreground">
          Project not found
        </p>
        <p className="max-w-sm text-[13px] text-text-secondary">
          This project doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Button variant="outline" onClick={() => router.push("/projects")} className="mt-2">
          Back to projects
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-8">
      <PageHeader
        title={project.name}
        subtitle={project.description ?? undefined}
        action={
          canManage ? (
            <Button
              variant="outline"
              onClick={() => router.push(`/projects/${project.id}/settings`)}
            >
              <Settings className="size-4" strokeWidth={1.75} />
              Settings
            </Button>
          ) : undefined
        }
      />

      {/* Board placeholder */}
      <div className="flex flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-border bg-card px-6 py-20 text-center">
        <span
          className="flex size-11 items-center justify-center rounded-full"
          style={{ backgroundColor: `${project.color}1a` }}
          aria-hidden
        >
          <KanbanSquare className="size-5" style={{ color: project.color }} strokeWidth={1.75} />
        </span>
        <p className="font-display text-[15px] font-semibold text-foreground">
          Board coming in Phase 5
        </p>
        <p className="max-w-sm text-[13px] text-text-secondary">
          The Kanban board for this project will live here.
        </p>
      </div>
    </div>
  );
}

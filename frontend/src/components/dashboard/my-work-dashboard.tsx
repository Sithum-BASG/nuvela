"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckSquare, FolderKanban } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorCallout } from "@/components/ui/error-callout";
import {
  DashboardSkeleton,
  ProjectProgressBar,
  SectionHeader,
  TaskListRow,
} from "@/components/dashboard/dashboard-shared";
import { dashboardApi, type MyTaskRow, type ProjectProgressRow } from "@/lib/dashboard-api";
import { useSlowFetch } from "@/hooks/use-slow-fetch";
import { classifyLoadError, type LoadErrorKind } from "@/lib/load-error";

function isDueSoon(task: MyTaskRow): boolean {
  if (!task.dueDate || task.isCompletedColumn) return false;
  const due = new Date(task.dueDate);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  horizon.setHours(23, 59, 59, 999);
  return due <= horizon;
}

export function MyWorkDashboard() {
  const [tasks, setTasks] = useState<MyTaskRow[]>([]);
  const [projects, setProjects] = useState<ProjectProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorKind | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await dashboardApi.myWork();
      setTasks(data.tasks);
      setProjects(data.projects);
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

  const dueSoon = useMemo(() => tasks.filter(isDueSoon), [tasks]);
  const isSlow = useSlowFetch(loading);

  if (loading) return <DashboardSkeleton isSlow={isSlow} />;

  if (loadError) {
    return (
      <ErrorCallout
        variant={loadError}
        onRetry={() => void load()}
      />
    );
  }

  const hasNoTasks = tasks.length === 0;
  const hasNoProjects = projects.length === 0;

  if (hasNoTasks && hasNoProjects) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No tasks assigned to you yet"
        description="Projects you have joined are listed below while you wait for assigned work."
        action={
          <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
            Go to projects
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {dueSoon.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Due soon / overdue" count={dueSoon.length} />
          <div className="flex flex-col gap-2">
            {dueSoon.map((task) => (
              <TaskListRow key={task.id} task={task} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader title="My tasks" count={tasks.length} href="/projects" />
        {hasNoTasks ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks assigned to you yet"
            description="When a task is assigned to you, it will show up here."
            size="compact"
            className="rounded-card border border-dashed border-border bg-card/40"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskListRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Project progress"
          count={projects.length}
          href="/projects"
        />
        {hasNoProjects ? (
          <EmptyState
            icon={FolderKanban}
            title="No active projects yet"
            description="Join a project to track progress here."
            size="compact"
            className="rounded-card border border-dashed border-border bg-card/40"
          />
        ) : (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-card p-5">
            {projects.map((project) => (
              <ProjectProgressBar key={project.id} {...project} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

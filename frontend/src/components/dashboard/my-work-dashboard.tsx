"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import {
  DashboardSkeleton,
  EmptyInboxState,
  ProjectProgressBar,
  SectionHeader,
  TaskListRow,
} from "@/components/dashboard/dashboard-shared";
import { dashboardApi, type MyTaskRow, type ProjectProgressRow } from "@/lib/dashboard-api";

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

  const load = useCallback(async () => {
    try {
      const data = await dashboardApi.myWork();
      setTasks(data.tasks);
      setProjects(data.projects);
    } catch {
      toast.error("Failed to load dashboard.");
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

  if (loading) return <DashboardSkeleton />;

  const hasNoTasks = tasks.length === 0;
  const hasNoProjects = projects.length === 0;

  if (hasNoTasks && hasNoProjects) {
    return (
      <EmptyInboxState
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
          <EmptyInboxState
            title="No tasks assigned to you yet"
            description="When a task is assigned to you, it will show up here."
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
          <div className="rounded-card border border-dashed border-border bg-card/40 px-6 py-10 text-center text-sm text-text-secondary">
            No active projects yet.
          </div>
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

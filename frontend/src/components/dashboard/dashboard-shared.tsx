import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  FolderKanban,
  Minus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format } from "date-fns";

import { Skeleton } from "@/components/ui/skeleton";
import { SlowFetchNotice } from "@/components/ui/slow-fetch-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { MyTaskRow } from "@/lib/dashboard-api";

const PRIORITY_ICON = {
  LOW: Minus,
  MEDIUM: AlertTriangle,
  HIGH: AlertCircle,
} as const;

export function DashboardSkeleton({ isSlow }: { isSlow?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[144px] rounded-card" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-[10px]" />
        ))}
      </div>
      {isSlow ? <SlowFetchNotice /> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon: Icon = CheckSquare,
}: {
  label: string;
  value: number;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-control bg-accent-tint text-primary">
          <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
        </span>
        <span className="text-[13px] font-medium text-text-secondary">{label}</span>
      </div>
      <p className="font-display text-[30px] font-semibold leading-none text-foreground">
        {value}
      </p>
    </div>
  );
}

export function SectionHeader({
  title,
  count,
  href,
  linkLabel = "View all",
}: {
  title: string;
  count?: number;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        {count !== undefined && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-muted px-1.5 text-[11px] font-medium text-text-secondary">
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 text-[13px] font-medium text-accent-strong transition-colors hover:text-primary motion-safe:transition-colors"
        >
          {linkLabel}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

export function ProjectProgressBar({
  name,
  color,
  totalTasks,
  completedTasks,
}: {
  name: string;
  color: string;
  totalTasks: number;
  completedTasks: number;
}) {
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const complete = pct >= 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-[13px] font-medium">
        <span className="flex min-w-0 items-center gap-2 text-text-secondary">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span className="truncate">{name}</span>
        </span>
        <span className={cn("shrink-0", complete ? "text-success" : "text-foreground")}>
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn(
            "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out",
            complete ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${name}: ${completedTasks} of ${totalTasks} tasks complete`}
        />
      </div>
    </div>
  );
}

export function TaskListRow({ task }: { task: MyTaskRow }) {
  const PriorityIcon = PRIORITY_ICON[task.priority];
  const overdue =
    task.dueDate &&
    !task.isCompletedColumn &&
    new Date(task.dueDate) < new Date(new Date().toDateString());

  return (
    <Link
      href={`/projects/${task.projectId}?task=${task.id}`}
      className="group flex items-center gap-3 rounded-[10px] border border-border bg-card px-3.5 py-3 outline-none transition-colors hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-muted text-text-secondary"
        aria-label={`Priority ${task.priority.toLowerCase()}`}
      >
        <PriorityIcon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {task.title}
        </p>
        <p className="truncate text-[12px] text-text-muted">
          {task.projectName} · {task.columnName}
        </p>
      </div>
      {task.dueDate && (
        <span
          className={cn(
            "shrink-0 text-[12px] font-medium",
            overdue ? "text-destructive" : "text-text-secondary",
          )}
        >
          {format(new Date(task.dueDate), "MMM d")}
        </span>
      )}
    </Link>
  );
}

export function QuickActionCard({
  label,
  body,
  href,
  icon: Icon = FolderKanban,
}: {
  label: string;
  body: string;
  href: string;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1.5 rounded-card border border-border bg-card p-5 outline-none transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors"
    >
      <span className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
        <Icon className="size-4 text-primary" strokeWidth={2} aria-hidden />
        {label}
      </span>
      <span className="text-[13px] leading-5 text-text-secondary">{body}</span>
    </Link>
  );
}

/** Back-compat wrapper — prefer `EmptyState` directly. */
export function EmptyInboxState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <EmptyState
      icon={FolderKanban}
      title={title}
      description={description}
      action={action}
    />
  );
}

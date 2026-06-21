"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { tasksApi } from "@/lib/tasks-api";
import type { TaskRow } from "@/lib/tasks-api.types";
import { avatarColor, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { InlineSpinner } from "@/components/ui/inline-spinner";

type Props = {
  task: TaskRow;
  isDragging?: boolean;
  isPm?: boolean;
  onClick?: () => void;
  onUpdated?: (task: TaskRow) => void;
  onDeleted?: (taskId: string) => void;
};

const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" } as const;

const PRIORITY_DOT = {
  LOW: "bg-priority-low",
  MEDIUM: "bg-priority-medium",
  HIGH: "bg-priority-high",
} as const;

export function TaskCard({
  task,
  isDragging = false,
  isPm = false,
  onClick,
  onDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isGhost = isSortableDragging && !isDragging;
  const visibleAssignees = task.assignees.slice(0, 3);
  const overflowCount = task.assignees.length - visibleAssignees.length;

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setDeleting(true);
    try {
      await tasksApi.tasks.delete(task.id);
      onDeleted?.(task.id);
      toast.success("Task deleted.");
    } catch {
      toast.error("Failed to delete task.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group relative flex cursor-grab flex-col gap-2.5 rounded-card border border-border bg-card p-3.5",
        "transition-[opacity,box-shadow] duration-150 motion-reduce:transition-none",
        "hover:border-border/80 active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isGhost && "opacity-40",
        isDragging && "rotate-[1.5deg] shadow-lg opacity-95 cursor-grabbing",
        deleting && "pointer-events-none opacity-50",
      )}
    >
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center rounded-badge px-2 py-[3px] text-[11px] font-medium text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <p className="text-[14px] font-medium leading-5 text-foreground line-clamp-2">
        {task.title}
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5 text-[12px]">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span
              className={cn("size-[7px] shrink-0 rounded-full", PRIORITY_DOT[task.priority])}
              aria-hidden
            />
            <span>{PRIORITY_LABEL[task.priority]}</span>
          </div>

          {task.checklistTotal > 0 && (
            <div className="flex items-center gap-1 text-text-muted">
              <CheckSquare className="size-3" strokeWidth={1.75} aria-hidden />
              <span>
                {task.checklistDone}/{task.checklistTotal}
              </span>
            </div>
          )}

          {task.dueDate && (
            <div className="flex items-center gap-1 text-text-muted">
              <span aria-hidden>·</span>
              <span>{format(new Date(task.dueDate), "MMM d")}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center">
          {overflowCount > 0 && (
            <span
              className="mr-[-8px] flex size-6 items-center justify-center rounded-[12px] border-2 border-card bg-accent-tint text-[10px] font-medium text-accent-strong"
              title={`${overflowCount} more assignee${overflowCount === 1 ? "" : "s"}`}
            >
              +{overflowCount}
            </span>
          )}
          {visibleAssignees.length > 0 ? (
            visibleAssignees.map((assignee, index) => (
              <span
                key={assignee.userId}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-card",
                  avatarColor(assignee.name),
                  index < visibleAssignees.length - 1 && "mr-[-8px]",
                )}
                title={assignee.name}
              >
                {initials(assignee.name)}
              </span>
            ))
          ) : (
            <span
              className="size-6 shrink-0 rounded-full border border-dashed border-border"
              title="Unassigned"
              aria-label="Unassigned"
            />
          )}
        </div>
      </div>

      {isPm && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-[4px] text-text-muted opacity-0 transition-opacity hover:bg-danger-tint hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger/50 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Delete ${task.title}`}
        >
          {deleting ? (
            <InlineSpinner className="size-[11px]" />
          ) : (
            <Trash2 className="size-[11px]" strokeWidth={2} />
          )}
        </button>
      )}
    </div>
  );
}

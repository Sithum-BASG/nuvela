"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, Calendar, AlertCircle, AlertTriangle, Minus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { tasksApi } from "@/lib/tasks-api";
import type { TaskRow } from "@/lib/tasks-api.types";
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

const PRIORITY_ICON = {
  LOW: <Minus className="size-[12px] text-priority-low" strokeWidth={2.5} />,
  MEDIUM: <AlertTriangle className="size-[12px] text-priority-medium" strokeWidth={2.5} />,
  HIGH: <AlertCircle className="size-[12px] text-priority-high" strokeWidth={2.5} />,
};

const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

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
        "group relative flex cursor-grab flex-col gap-2 rounded-[8px] border border-border bg-card p-3 shadow-sm",
        "transition-[opacity,shadow] duration-150",
        "hover:shadow-md hover:border-border/70 active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isGhost && "opacity-40",
        isDragging && "rotate-[1.5deg] shadow-lg opacity-95 cursor-grabbing",
        deleting && "opacity-50 pointer-events-none",
      )}
    >
      {/* Priority + title row */}
      <div className="flex items-start gap-1.5">
        <span
          className="mt-[3px] shrink-0"
          aria-label={`Priority: ${PRIORITY_LABEL[task.priority]}`}
        >
          {PRIORITY_ICON[task.priority]}
        </span>
        <span className="text-[13px] font-medium leading-snug text-foreground line-clamp-2">
          {task.title}
        </span>
      </div>

      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex h-[18px] items-center rounded-[4px] px-1.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer row: checklist + due date + assignees + delete */}
      <div className="flex items-center gap-2">
        {/* Checklist progress */}
        {task.checklistTotal > 0 && (
          <div className="flex items-center gap-1 text-text-secondary">
            <CheckSquare className="size-[12px]" strokeWidth={1.75} />
            <span className="text-[11px]">
              {task.checklistDone}/{task.checklistTotal}
            </span>
          </div>
        )}

        {/* Due date */}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-text-secondary">
            <Calendar className="size-[12px]" strokeWidth={1.75} />
            <span className="text-[11px]">
              {format(new Date(task.dueDate), "MMM d")}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Assignee avatars */}
        {task.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              <span
                key={a.userId}
                className="flex size-[20px] items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground ring-2 ring-card"
                title={a.name}
              >
                {a.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
            {task.assignees.length > 3 && (
              <span className="flex size-[20px] items-center justify-center rounded-full bg-border text-[9px] font-medium text-text-secondary ring-2 ring-card">
                +{task.assignees.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Delete (PM/Owner only) */}
        {isPm && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDelete}
            disabled={deleting}
            className="flex size-5 items-center justify-center rounded-[4px] text-text-muted opacity-0 transition-opacity hover:bg-danger-tint hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger/50 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  );
}

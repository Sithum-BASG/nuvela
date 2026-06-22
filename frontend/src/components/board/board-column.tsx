"use client";

import { useState } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Lock, CheckSquare } from "lucide-react";

import type { ColumnRow, TaskRow } from "@/lib/tasks-api.types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskCard } from "./task-card";
import { CreateTaskModal } from "./create-task-modal";
import { cn } from "@/lib/utils";

type Props = {
  column: ColumnRow;
  tasks: TaskRow[];
  isPm: boolean;
  isCollaborator: boolean;
  projectId: string;
  onTaskClick: (task: TaskRow) => void;
  onTaskCreated: (task: TaskRow) => void;
  onTaskUpdated: (task: TaskRow) => void;
  onTaskDeleted: (taskId: string) => void;
};

export function BoardColumn({
  column,
  tasks,
  isPm,
  isCollaborator,
  projectId,
  onTaskClick,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const sorted = [...tasks].sort((a, b) => a.position - b.position);
  const isAccentColumn = column.position === 0;

  return (
    <div className="flex min-w-[260px] flex-1 flex-col gap-3">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          {isAccentColumn && (
            <span
              className="size-[7px] shrink-0 rounded-full bg-primary"
              aria-hidden
            />
          )}
          <span
            className={cn(
              "text-[13px] font-medium tracking-[0.13px] uppercase",
              isAccentColumn ? "text-accent-strong" : "text-text-secondary",
            )}
          >
            {column.name}
          </span>
          <span className="flex items-center justify-center rounded-[10px] bg-border/50 px-[7px] py-px text-[12px] font-medium text-text-secondary">
            {tasks.length}
          </span>
          {isCollaborator && column.isPmGated && (
            <span
              className="flex items-center gap-0.5 rounded-[4px] bg-warning-tint px-1.5 py-[2px] text-[10px] font-medium text-warning"
              title="Only a Project Manager can move tasks into this column"
            >
              <Lock className="size-[9px]" strokeWidth={2.5} />
              PM only
            </span>
          )}
        </div>
        {isPm && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex size-4 items-center justify-center rounded-[4px] text-text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={`Add task to ${column.name}`}
          >
            <Plus className="size-4" strokeWidth={2} />
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-col gap-2 rounded-card transition-colors duration-150 motion-reduce:transition-none",
          isOver && "bg-accent-tint/30",
        )}
      >
        <SortableContext
          items={sorted.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {sorted.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isPm={isPm}
              onClick={() => onTaskClick(task)}
              onUpdated={onTaskUpdated}
              onDeleted={onTaskDeleted}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 &&
          (column.position === 0 && isPm ? (
            <EmptyState
              size="compact"
              icon={CheckSquare}
              title="Add your first task"
              description="Create a task to get this board moving."
              action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Add task
                </Button>
              }
            />
          ) : (
            <EmptyState size="minimal" icon={CheckSquare} title="No tasks" />
          ))}
      </div>

      {isPm && (
        <CreateTaskModal
          open={createOpen}
          projectId={projectId}
          onClose={() => setCreateOpen(false)}
          onCreated={(task) => {
            onTaskCreated(task);
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

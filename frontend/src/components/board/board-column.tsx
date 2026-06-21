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

  // Make the column itself a drop target so empty columns accept drops
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const sorted = [...tasks].sort((a, b) => a.position - b.position);

  return (
    <div
      className={[
        "flex w-[272px] shrink-0 flex-col gap-2 rounded-[12px] border bg-card p-3 transition-colors duration-150 motion-reduce:transition-none",
        isOver ? "border-primary/40 bg-accent-tint/30" : "border-border",
      ].join(" ")}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">
            {column.name}
          </span>
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-border px-1 text-[11px] font-medium text-text-secondary">
            {tasks.length}
          </span>
          {/* Lock badge — visible to Collaborators on PM-gated columns */}
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
            className="flex size-6 items-center justify-center rounded-[6px] text-text-muted transition-colors hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-white/10"
            aria-label={`Add task to ${column.name}`}
          >
            <Plus className="size-[14px]" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Drop zone + sortable task list */}
      <div ref={setNodeRef} className="flex flex-1 flex-col gap-2">
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
      </div>

      {/* Empty column hint */}
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

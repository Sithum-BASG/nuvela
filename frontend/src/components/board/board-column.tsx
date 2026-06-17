"use client";

import { useState } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";

import type { ColumnRow, TaskRow } from "@/lib/tasks-api.types";
import { TaskCard } from "./task-card";
import { CreateTaskModal } from "./create-task-modal";

type Props = {
  column: ColumnRow;
  tasks: TaskRow[];
  isPm: boolean;
  projectId: string;
  onTaskCreated: (task: TaskRow) => void;
  onTaskUpdated: (task: TaskRow) => void;
  onTaskDeleted: (taskId: string) => void;
};

export function BoardColumn({
  column,
  tasks,
  isPm,
  projectId,
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
        "flex w-[272px] shrink-0 flex-col gap-2 rounded-[12px] border bg-card p-3 transition-colors duration-150",
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
              onUpdated={onTaskUpdated}
              onDeleted={onTaskDeleted}
            />
          ))}
        </SortableContext>
      </div>

      {/* Empty column hint */}
      {tasks.length === 0 && (
        <p className="py-4 text-center text-[12px] text-text-muted">
          No tasks
        </p>
      )}

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

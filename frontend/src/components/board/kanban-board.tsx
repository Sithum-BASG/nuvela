"use client";

import { useState, useEffect, useCallback, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { tasksApi } from "@/lib/tasks-api";
import { useAuth } from "@/providers/auth-provider";
import type { ColumnRow, TaskRow } from "@/lib/tasks-api.types";
import { BoardColumn } from "./board-column";
import { TaskCard } from "./task-card";
import { ApiError } from "@/lib/api-client";
import { TaskDetailPanel } from "./task-detail-panel";
import { BoardSkeleton } from "@/components/ui/loading-states";
import { ErrorCallout } from "@/components/ui/error-callout";
import { useSlowFetch } from "@/hooks/use-slow-fetch";
import { classifyLoadError, type LoadErrorKind } from "@/lib/load-error";

type Props = {
  projectId: string;
  projectManagerId: string;
  initialTaskId?: string | null;
};

export function KanbanBoard({ projectId, projectManagerId, initialTaskId }: Props) {
  const { user: me } = useAuth();
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorKind | null>(null);

  // active drag state
  const [activeTask, setActiveTask] = useState<TaskRow | null>(null);
  // detail panel
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);

  // optimistic tasks layer
  const [optimisticTasks, setOptimisticTask] = useOptimistic(
    tasks,
    (prev: TaskRow[], update: TaskRow[]) => update,
  );

  const [, startTransition] = useTransition();

  const isPm =
    me?.role === "OWNER" ||
    (me?.role === "PROJECT_MANAGER" && me.id === projectManagerId);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [cols, tks] = await Promise.all([
        tasksApi.columns.list(projectId),
        tasksApi.tasks.list(projectId),
      ]);
      setColumns(cols);
      setTasks(tks);
    } catch (err) {
      setLoadError(classifyLoadError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => {/* handled inside load */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!initialTaskId || tasks.length === 0) return;
    const match = tasks.find((t) => t.id === initialTaskId);
    if (match) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- open deep-linked task once board data loads
      setSelectedTask(match);
    }
  }, [initialTaskId, tasks]);

  // ─── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTaskItem = tasks.find((t) => t.id === active.id);
    if (!activeTaskItem) return;

    // Determine target column: over a task → use that task's column; over a column → use column id
    const overTask = tasks.find((t) => t.id === over.id);
    const targetColumnId = overTask ? overTask.columnId : (over.id as string);
    if (targetColumnId === activeTaskItem.columnId) return;

    // Optimistic column switch for smooth visual feedback
    startTransition(() => {
      setOptimisticTask(
        tasks.map((t) =>
          t.id === activeTaskItem.id ? { ...t, columnId: targetColumnId } : t,
        ),
      );
    });
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeTaskItem = tasks.find((t) => t.id === active.id);
    if (!activeTaskItem) return;

    const overTask = tasks.find((t) => t.id === over.id);
    const targetColumnId = overTask
      ? overTask.columnId
      : (over.id as string);

    // Compute target position
    const columnTasks = tasks
      .filter((t) => t.id !== activeTaskItem.id && t.columnId === targetColumnId)
      .sort((a, b) => a.position - b.position);

    let targetPosition = columnTasks.length;
    if (overTask && overTask.id !== activeTaskItem.id) {
      const overIdx = columnTasks.findIndex((t) => t.id === overTask.id);
      targetPosition = overIdx >= 0 ? overIdx : columnTasks.length;
    }

    // Optimistic update: immediately show new state in UI
    const updatedTasks = applyMoveLocally(
      tasks,
      activeTaskItem.id,
      targetColumnId,
      targetPosition,
    );
    setTasks(updatedTasks);

    try {
      await tasksApi.tasks.move(activeTaskItem.id, {
        columnId: targetColumnId,
        position: targetPosition,
      });
      // Refresh from server to get canonical positions
      const fresh = await tasksApi.tasks.list(projectId);
      setTasks(fresh);
    } catch (err) {
      // Rollback optimistic move
      setTasks(tasks);
      if (err instanceof ApiError) {
        toast.error(err.message);
        return;
      }
      toast.error("Failed to move task.");
    }
  }

  const isSlow = useSlowFetch(loading);

  if (loading) return <BoardSkeleton isSlow={isSlow} />;

  if (loadError) {
    return (
      <div className="px-6 py-4">
        <ErrorCallout variant={loadError} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full gap-3 overflow-x-auto px-4 pb-4 pt-2 sm:px-6">
        {columns.map((col) => (
          <BoardColumn
            key={col.id}
            column={col}
            tasks={optimisticTasks.filter((t) => t.columnId === col.id)}
            isPm={isPm}
            isCollaborator={me?.role === "COLLABORATOR"}
            projectId={projectId}
            onTaskClick={(task) => setSelectedTask(task)}
            onTaskCreated={(task) => setTasks((prev) => [...prev, task])}
            onTaskUpdated={(task) =>
              setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
            }
            onTaskDeleted={(taskId) =>
              setTasks((prev) => prev.filter((t) => t.id !== taskId))
            }
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>

    <TaskDetailPanel
      task={selectedTask}
      columnName={
        selectedTask
          ? columns.find((c) => c.id === selectedTask.columnId)?.name
          : undefined
      }
      isPm={isPm}
      me={me ? { id: me.id, name: me.name } : null}
      onClose={() => setSelectedTask(null)}
      onUpdated={(task) => {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
        setSelectedTask(task);
      }}
      onDeleted={(taskId) => {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        setSelectedTask(null);
      }}
    />
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyMoveLocally(
  tasks: TaskRow[],
  taskId: string,
  targetColumnId: string,
  targetPosition: number,
): TaskRow[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return tasks;

  // Remove from source, renumber
  const sourceColumn = tasks
    .filter((t) => t.id !== taskId && t.columnId === task.columnId)
    .sort((a, b) => a.position - b.position)
    .map((t, i) => ({ ...t, position: i }));

  // Insert into target at position, renumber
  const targetColumn = tasks
    .filter((t) => t.id !== taskId && t.columnId === targetColumnId)
    .sort((a, b) => a.position - b.position);

  targetColumn.splice(targetPosition, 0, {
    ...task,
    columnId: targetColumnId,
    position: targetPosition,
  });
  const reNumberedTarget = targetColumn.map((t, i) => ({ ...t, position: i }));

  // Merge: keep all other tasks, replace source + target column tasks
  return tasks
    .filter(
      (t) =>
        t.id !== taskId &&
        t.columnId !== task.columnId &&
        t.columnId !== targetColumnId,
    )
    .concat(sourceColumn)
    .concat(reNumberedTarget);
}

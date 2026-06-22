"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  X,
  Calendar,
  Trash2,
  Check,
  Plus,
} from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";

import { tasksApi } from "@/lib/tasks-api";
import type { TaskRow, ChecklistItemRow } from "@/lib/tasks-api.types";
import { cn } from "@/lib/utils";
import { LabelManager } from "./label-manager";
import { TaskDueDateField } from "./task-due-date-field";
import { TaskAssigneePicker } from "./task-assignee-picker";
import { CommentThread } from "./comment-thread";
import { AttachmentSection } from "./attachment-section";
import { ActivityTimeline } from "./activity-timeline";
import { ChecklistSkeleton } from "@/components/ui/loading-states";

type Props = {
  task: TaskRow | null;
  columnName?: string;
  isPm: boolean;
  me: { id: string; name: string } | null;
  onClose: () => void;
  onUpdated: (task: TaskRow) => void;
  onDeleted: (taskId: string) => void;
};

const PRIORITY_PILL = {
  LOW: {
    label: "Low",
    dot: "bg-priority-low",
    className: "bg-border/50 text-text-secondary",
  },
  MEDIUM: {
    label: "Medium",
    dot: "bg-priority-medium",
    className: "bg-priority-medium-tint text-priority-medium",
  },
  HIGH: {
    label: "High",
    dot: "bg-priority-high",
    className: "bg-priority-high-tint text-priority-high",
  },
} as const;

export function TaskDetailPanel({
  task,
  columnName,
  isPm,
  me,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const [checklist, setChecklist] = useState<ChecklistItemRow[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const open = task !== null;

  useEffect(() => {
    if (!task) {
      setChecklist([]); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    setTitleDraft(task.title);
    if (task.checklistTotal === 0) {
      setChecklist([]);
      return;
    }
    setLoadingChecklist(true);
    tasksApi.tasks
      .get(task.id)
      .then((full) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setChecklist((full as any).checklist ?? []);
      })
      .catch(() => toast.error("Failed to load checklist."))
      .finally(() => setLoadingChecklist(false));
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveTitle() {
    if (!task || titleDraft.trim() === task.title) {
      setEditingTitle(false);
      return;
    }
    try {
      const updated = await tasksApi.tasks.update(task.id, {
        title: titleDraft.trim(),
      });
      onUpdated(updated);
      toast.success("Title updated.");
    } catch {
      toast.error("Failed to update title.");
      setTitleDraft(task.title);
    } finally {
      setEditingTitle(false);
    }
  }

  async function addChecklistItem() {
    if (!task || !newItemText.trim()) return;
    setAddingItem(true);
    try {
      const item = await tasksApi.checklist.add(task.id, {
        text: newItemText.trim(),
      });
      setChecklist((prev) => [...prev, item]);
      setNewItemText("");
      onUpdated({
        ...task,
        checklistTotal: task.checklistTotal + 1,
      });
    } catch {
      toast.error("Failed to add checklist item.");
    } finally {
      setAddingItem(false);
    }
  }

  async function toggleChecklistItem(item: ChecklistItemRow) {
    if (!task) return;
    const updated = await tasksApi.checklist
      .update(item.id, { isChecked: !item.isChecked })
      .catch(() => {
        toast.error("Failed to update item.");
        return null;
      });
    if (!updated) return;
    setChecklist((prev) =>
      prev.map((i) => (i.id === item.id ? updated : i)),
    );
    const doneCount = checklist.filter(
      (i) => (i.id === item.id ? !i.isChecked : i.isChecked),
    ).length;
    onUpdated({ ...task, checklistDone: doneCount });
  }

  async function deleteChecklistItem(itemId: string) {
    if (!task) return;
    try {
      await tasksApi.checklist.delete(itemId);
      setChecklist((prev) => prev.filter((i) => i.id !== itemId));
      onUpdated({
        ...task,
        checklistTotal: task.checklistTotal - 1,
        checklistDone: checklist.filter(
          (i) => i.id !== itemId && i.isChecked,
        ).length,
      });
    } catch {
      toast.error("Failed to delete item.");
    }
  }

  async function handleDeleteTask() {
    if (!task) return;
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await tasksApi.tasks.delete(task.id);
      onDeleted(task.id);
      onClose();
      toast.success("Task deleted.");
    } catch {
      toast.error("Failed to delete task.");
    }
  }

  const priority = task ? PRIORITY_PILL[task.priority] : null;
  const isOverdue =
    task?.dueDate &&
    isBefore(startOfDay(new Date(task.dueDate)), startOfDay(new Date()));

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-[rgba(15,18,26,0.4)] transition-opacity duration-200 motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[1040px] flex-col bg-card shadow-[-8px_0_32px_-4px_rgba(0,0,0,0.12)]",
          "max-md:inset-0 max-md:max-w-none",
          "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {task && (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* Main column */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">
                <div className="flex flex-col gap-[18px]">
                  <div className="flex items-start justify-between gap-3 md:hidden">
                    <div className="flex-1" />
                    <CloseButton onClose={onClose} />
                  </div>

                  {/* Title */}
                  {editingTitle && isPm ? (
                    <input
                      autoFocus
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveTitle();
                        if (e.key === "Escape") {
                          setTitleDraft(task.title);
                          setEditingTitle(false);
                        }
                      }}
                      className="w-full rounded-control border border-primary/50 bg-background px-2 py-1 font-display text-xl font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                  ) : (
                    <h2
                      className={cn(
                        "font-display text-xl font-semibold leading-7 text-foreground",
                        isPm && "cursor-pointer hover:text-accent-strong",
                      )}
                      onClick={() => isPm && setEditingTitle(true)}
                      title={isPm ? "Click to edit" : undefined}
                    >
                      {task.title}
                    </h2>
                  )}

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {columnName && (
                      <span className="text-[13px] font-medium text-foreground">
                        {columnName}
                      </span>
                    )}
                    {priority && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-badge py-1 pl-2 pr-2.5 text-[12px] font-medium",
                          priority.className,
                        )}
                      >
                        <span
                          className={cn("size-[7px] rounded-full", priority.dot)}
                          aria-hidden
                        />
                        {priority.label}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="inline-flex items-center gap-1.5 rounded-badge border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-text-secondary">
                        <Calendar className="size-3" strokeWidth={2} aria-hidden />
                        {format(new Date(task.dueDate), "MMM d")}
                      </span>
                    )}
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1.5 rounded-badge bg-priority-high-tint px-2.5 py-1 text-[12px] font-medium text-priority-high">
                        <Calendar className="size-3" strokeWidth={2} aria-hidden />
                        Overdue
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <section className="flex flex-col gap-2">
                    <SectionHeading>Description</SectionHeading>
                    <p className="text-[14px] leading-5 text-foreground">
                      {task.description?.trim() || (
                        <span className="text-text-muted">No description.</span>
                      )}
                    </p>
                  </section>

                  {/* Due date */}
                  <TaskDueDateField
                    task={task}
                    isPm={isPm}
                    onUpdated={onUpdated}
                  />

                  {/* Assignees */}
                  <TaskAssigneePicker
                    task={task}
                    isPm={isPm}
                    onUpdated={onUpdated}
                  />

                  {/* Labels */}
                  <section className="flex flex-col gap-2">
                    <SectionHeading>Labels</SectionHeading>
                    <LabelManager
                      projectId={task.projectId}
                      taskId={task.id}
                      appliedLabels={task.labels}
                      isPm={isPm}
                      onLabelsChanged={(labels) => onUpdated({ ...task, labels })}
                    />
                  </section>

                  {/* Checklist */}
                  <section className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <SectionHeading>Checklist</SectionHeading>
                        {task.checklistTotal > 0 && (
                          <span className="text-[13px] font-medium text-text-muted">
                            {task.checklistDone}/{task.checklistTotal}
                          </span>
                        )}
                      </div>
                      {task.checklistTotal > 0 && (
                        <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-border/60">
                          <div
                            className="h-full rounded-[3px] bg-primary transition-all duration-300 motion-reduce:transition-none"
                            style={{
                              width: `${Math.round((task.checklistDone / task.checklistTotal) * 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {loadingChecklist ? (
                      <ChecklistSkeleton count={2} />
                    ) : (
                      <div className="flex flex-col gap-2">
                        {checklist.map((item) => (
                          <div
                            key={item.id}
                            className="group flex h-11 items-center gap-3 rounded-control border border-border bg-card px-3"
                          >
                            <button
                              onClick={() => void toggleChecklistItem(item)}
                              className={cn(
                                "flex size-[18px] shrink-0 items-center justify-center rounded-badge border transition-colors",
                                item.isChecked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card hover:border-primary",
                              )}
                              aria-label={
                                item.isChecked ? "Uncheck item" : "Check item"
                              }
                            >
                              {item.isChecked && (
                                <Check className="size-3" strokeWidth={3} />
                              )}
                            </button>
                            <span
                              className={cn(
                                "flex-1 text-[14px]",
                                item.isChecked
                                  ? "text-text-muted line-through"
                                  : "text-foreground",
                              )}
                            >
                              {item.text}
                            </span>
                            {isPm && (
                              <button
                                onClick={() => void deleteChecklistItem(item.id)}
                                className="flex size-5 items-center justify-center rounded-[4px] text-text-muted opacity-0 transition-opacity hover:bg-danger-tint hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                                aria-label="Delete item"
                              >
                                <Trash2 className="size-[11px]" strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {isPm && (
                      <div className="flex h-[38px] items-center gap-2 rounded-control border border-dashed border-border px-2.5">
                        <Plus className="size-3.5 shrink-0 text-text-muted" />
                        <input
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void addChecklistItem();
                          }}
                          placeholder="Add an item"
                          disabled={addingItem}
                          className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-text-muted focus:outline-none"
                        />
                      </div>
                    )}
                  </section>

                  {/* Attachments */}
                  {me && (
                    <AttachmentSection
                      taskId={task.id}
                      meId={me.id}
                      canModerate={isPm}
                    />
                  )}

                  {/* Activity */}
                  <ActivityTimeline taskId={task.id} />

                  {/* Mobile comments */}
                  {me && (
                    <section className="flex flex-col gap-3 md:hidden">
                      <SectionHeading>Comments</SectionHeading>
                      <CommentThread
                        taskId={task.id}
                        projectId={task.projectId}
                        me={me}
                        canModerate={isPm}
                      />
                    </section>
                  )}

                  {isPm && (
                    <button
                      onClick={() => void handleDeleteTask()}
                      className="flex w-fit items-center gap-1.5 rounded-control px-2 py-1.5 text-[13px] text-danger transition-colors hover:bg-danger-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30 md:mt-2"
                    >
                      <Trash2 className="size-[13px]" strokeWidth={2} />
                      Delete task
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Comments sidebar ΓÇö desktop */}
            {me && (
              <>
                <div className="hidden w-px shrink-0 bg-border md:block" />
                <div className="hidden min-h-0 w-[460px] shrink-0 flex-col bg-surface-muted/40 md:flex">
                  <div className="flex items-center justify-between px-5 pt-6">
                    <h3 className="font-display text-base font-semibold text-foreground">
                      Comments
                    </h3>
                    <CloseButton onClose={onClose} />
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
                    <CommentThread
                      taskId={task.id}
                      projectId={task.projectId}
                      me={me}
                      canModerate={isPm}
                      variant="sidebar"
                    />
                  </div>
                </div>
              </>
            )}

            {!me && (
              <div className="absolute top-6 right-6 hidden md:block">
                <CloseButton onClose={onClose} />
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-base font-semibold text-foreground">
      {children}
    </h3>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="flex size-8 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-white/10"
      aria-label="Close panel"
    >
      <X className="size-[18px]" strokeWidth={2} />
    </button>
  );
}

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  X,
  AlertCircle,
  AlertTriangle,
  Minus,
  Calendar,
  Trash2,
  CheckSquare,
} from "lucide-react";
import { format } from "date-fns";

import { tasksApi } from "@/lib/tasks-api";
import type { TaskRow, ChecklistItemRow } from "@/lib/tasks-api.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LabelManager } from "./label-manager";
import { CommentThread } from "./comment-thread";
import { AttachmentSection } from "./attachment-section";

type Props = {
  task: TaskRow | null;
  isPm: boolean;
  me: { id: string; name: string } | null;
  onClose: () => void;
  onUpdated: (task: TaskRow) => void;
  onDeleted: (taskId: string) => void;
};

const PRIORITY_CONFIG = {
  LOW: {
    label: "Low",
    icon: <Minus className="size-[13px]" strokeWidth={2.5} />,
    className: "text-priority-low bg-priority-low-tint",
  },
  MEDIUM: {
    label: "Medium",
    icon: <AlertTriangle className="size-[13px]" strokeWidth={2.5} />,
    className: "text-priority-medium bg-priority-medium-tint",
  },
  HIGH: {
    label: "High",
    icon: <AlertCircle className="size-[13px]" strokeWidth={2.5} />,
    className: "text-priority-high bg-priority-high-tint",
  },
};

export function TaskDetailPanel({
  task,
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

  // Load checklist whenever the panel opens for a task
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

  // ─── Title inline edit ───────────────────────────────────────────────────

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

  // ─── Checklist ────────────────────────────────────────────────────────────

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

  // ─── Delete task ──────────────────────────────────────────────────────────

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

  const priority = task ? PRIORITY_CONFIG[task.priority] : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-card shadow-2xl",
          "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {task && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex flex-1 flex-col gap-1.5">
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
                    className="w-full rounded-[6px] border border-primary/50 bg-background px-2 py-1 text-[15px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                ) : (
                  <h2
                    className={cn(
                      "text-[15px] font-semibold leading-snug text-foreground",
                      isPm && "cursor-pointer hover:text-accent-strong",
                    )}
                    onClick={() => isPm && setEditingTitle(true)}
                    title={isPm ? "Click to edit" : undefined}
                  >
                    {task.title}
                  </h2>
                )}

                {/* Priority badge */}
                {priority && (
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1 rounded-[5px] px-2 py-[3px] text-[11px] font-medium",
                      priority.className,
                    )}
                  >
                    {priority.icon}
                    {priority.label}
                  </span>
                )}
              </div>

              <button
                onClick={onClose}
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[6px] text-text-muted transition-colors hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-white/10"
                aria-label="Close panel"
              >
                <X className="size-[16px]" strokeWidth={2} />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
              {/* Description */}
              {task.description && (
                <div className="flex flex-col gap-1.5">
                  <SectionLabel>Description</SectionLabel>
                  <p className="text-[13px] leading-relaxed text-text-secondary">
                    {task.description}
                  </p>
                </div>
              )}

              {/* Meta row: due date */}
              {task.dueDate && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Calendar className="size-[13px]" strokeWidth={1.75} />
                  <span className="text-[13px]">
                    Due {format(new Date(task.dueDate), "MMM d, yyyy")}
                  </span>
                </div>
              )}

              {/* Assignees */}
              {task.assignees.length > 0 && (
                <div className="flex flex-col gap-2">
                  <SectionLabel>Assignees</SectionLabel>
                  <div className="flex flex-col gap-1.5">
                    {task.assignees.map((a) => (
                      <div key={a.userId} className="flex items-center gap-2">
                        <span className="flex size-[26px] items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                          {a.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium text-foreground">
                            {a.name}
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {a.email}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Labels */}
              <div className="flex flex-col gap-2">
                <SectionLabel>Labels</SectionLabel>
                <LabelManager
                  projectId={task.projectId}
                  taskId={task.id}
                  appliedLabels={task.labels}
                  isPm={isPm}
                  onLabelsChanged={(labels) => onUpdated({ ...task, labels })}
                />
              </div>

              {/* Checklist */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <SectionLabel>
                    Checklist
                    {task.checklistTotal > 0 && (
                      <span className="ml-1.5 text-text-muted">
                        {task.checklistDone}/{task.checklistTotal}
                      </span>
                    )}
                  </SectionLabel>
                </div>

                {/* Progress bar */}
                {task.checklistTotal > 0 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-success transition-all duration-300"
                      style={{
                        width: `${Math.round((task.checklistDone / task.checklistTotal) * 100)}%`,
                      }}
                    />
                  </div>
                )}

                {loadingChecklist ? (
                  <div className="flex flex-col gap-1.5">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-8 animate-pulse rounded-[6px] bg-border"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {checklist.map((item) => (
                      <div
                        key={item.id}
                        className="group flex items-center gap-2 rounded-[6px] px-2 py-1.5 hover:bg-surface-muted"
                      >
                        <button
                          onClick={() => void toggleChecklistItem(item)}
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                            item.isChecked
                              ? "border-success bg-success text-white"
                              : "border-border bg-background hover:border-primary",
                          )}
                          aria-label={
                            item.isChecked ? "Uncheck item" : "Check item"
                          }
                        >
                          {item.isChecked && (
                            <CheckSquare className="size-[10px]" strokeWidth={3} />
                          )}
                        </button>
                        <span
                          className={cn(
                            "flex-1 text-[13px]",
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

                {/* Add checklist item (PM only) */}
                {isPm && (
                  <div className="flex gap-2 pt-1">
                    <input
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void addChecklistItem();
                      }}
                      placeholder="Add an item…"
                      className="flex-1 rounded-[6px] border border-input bg-background px-3 py-1.5 text-[13px] text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                    <Button
                      size="sm"
                      disabled={!newItemText.trim() || addingItem}
                      onClick={() => void addChecklistItem()}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>

              {/* Comments */}
              {me && (
                <CommentThread
                  taskId={task.id}
                  projectId={task.projectId}
                  me={me}
                  canModerate={isPm}
                />
              )}

              {/* Attachments */}
              {me && (
                <AttachmentSection
                  taskId={task.id}
                  meId={me.id}
                  canModerate={isPm}
                />
              )}
            </div>

            {/* Footer */}
            {isPm && (
              <div className="border-t border-border px-5 py-3">
                <button
                  onClick={() => void handleDeleteTask()}
                  className="flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[13px] text-danger transition-colors hover:bg-danger-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                >
                  <Trash2 className="size-[13px]" strokeWidth={2} />
                  Delete task
                </button>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}

function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
      {children}
    </span>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { tasksApi } from "@/lib/tasks-api";
import type { TaskRow } from "@/lib/tasks-api.types";
import { projectsApi } from "@/lib/projects-api";
import type { MemberRow } from "@/lib/projects-api.types";
import { avatarColor, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { InlineSpinner } from "@/components/ui/inline-spinner";

type Props = {
  task: TaskRow;
  isPm: boolean;
  onUpdated: (task: TaskRow) => void;
};

export function TaskAssigneePicker({ task, isPm, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const assignedIds = new Set(task.assignees.map((a) => a.userId));
  const available = members.filter((m) => !assignedIds.has(m.userId));

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    projectsApi.members
      .list(task.projectId)
      .then(setMembers)
      .catch(() => toast.error("Failed to load project members."))
      .finally(() => setLoading(false));
  }, [open, task.projectId]);

  if (!isPm && task.assignees.length === 0) return null;

  async function addAssignee(userId: string) {
    setBusyUserId(userId);
    try {
      const updated = await tasksApi.tasks.assignees.add(task.id, userId);
      onUpdated(updated);
      toast.success("Assignee added.");
    } catch {
      toast.error("Failed to add assignee.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function removeAssignee(userId: string) {
    setBusyUserId(userId);
    try {
      await tasksApi.tasks.assignees.remove(task.id, userId);
      onUpdated({
        ...task,
        assignees: task.assignees.filter((a) => a.userId !== userId),
      });
      toast.success("Assignee removed.");
    } catch {
      toast.error("Failed to remove assignee.");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-foreground">
          Assignees
        </h3>
        {isPm && (
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-dashed border-border px-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Add assignee
            </button>

            {open && (
              <div className="absolute top-full right-0 z-10 mt-2 w-[min(100vw-3rem,300px)] rounded-xl border border-border bg-card p-2 shadow-lg ring-1 ring-foreground/5">
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <InlineSpinner />
                  </div>
                ) : available.length === 0 ? (
                  <p className="px-2 py-4 text-center text-[13px] text-text-muted">
                    All project members are already assigned.
                  </p>
                ) : (
                  <ul className="max-h-56 overflow-y-auto">
                    {available.map((member) => (
                      <li key={member.userId}>
                        <button
                          type="button"
                          disabled={busyUserId === member.userId}
                          onClick={() => void addAssignee(member.userId)}
                          className="flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <AssigneeAvatar name={member.name} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-foreground">
                              {member.name}
                            </span>
                            <span className="block truncate text-[11px] text-text-muted">
                              {member.email}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {task.assignees.length === 0 ? (
        <p className="text-[13px] text-text-muted">No assignees yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {task.assignees.map((assignee) => (
            <li
              key={assignee.userId}
              className="flex items-center gap-2.5 rounded-control bg-surface-muted px-2.5 py-2"
            >
              <AssigneeAvatar name={assignee.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {assignee.name}
                </span>
                <span className="block truncate text-[11px] text-text-muted">
                  {assignee.email}
                </span>
              </span>
              {isPm && (
                <button
                  type="button"
                  disabled={busyUserId === assignee.userId}
                  onClick={() => void removeAssignee(assignee.userId)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-text-muted transition-colors hover:bg-danger-tint hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label={`Remove ${assignee.name}`}
                >
                  <X className="size-3.5" strokeWidth={2} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AssigneeAvatar({ name }: { name: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
        avatarColor(name),
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

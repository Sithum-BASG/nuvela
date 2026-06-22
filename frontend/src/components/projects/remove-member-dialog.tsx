"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { RemoveMemberCheckSkeleton } from "@/components/ui/loading-states";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projectsApi } from "@/lib/projects-api";
import type { MemberRow } from "@/lib/projects-api.types";

// Figma "Member removal reassignment dialog" (node 1022:4163).
// Two-phase: first call returns assignedTasks; if non-empty, show reassignment
// selects per task before confirming. If empty, simple confirmation.

type AssignedTask = { id: string; title: string };

type Props = {
  open: boolean;
  projectId: string;
  member: MemberRow;
  // Remaining members available as reassignment targets (excludes the member
  // being removed — caller filters before passing).
  remainingMembers: MemberRow[];
  onClose: () => void;
  onRemoved: (userId: string) => void;
};

export function RemoveMemberDialog({
  open,
  projectId,
  member,
  remainingMembers,
  onClose,
  onRemoved,
}: Props) {
  // "checking" → first DELETE call to discover tasks; "reassign" → show task
  // rows with selects; "simple" → no tasks, just confirm; "confirming" → final
  // DELETE in flight.
  const [phase, setPhase] = useState<"checking" | "reassign" | "simple" | "confirming">(
    "checking",
  );
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  // taskId → newAssigneeId (null = leave unassigned)
  const [reassignments, setReassignments] = useState<Record<string, string | null>>({});

  // Discover tasks on open.
  useEffect(() => {
    if (!open) return;
    async function check() {
      setPhase("checking");
      setAssignedTasks([]);
      setReassignments({});
      try {
        const res = await projectsApi.members.remove(projectId, member.userId);
        const tasks = res.assignedTasks ?? [];
        if (tasks.length > 0) {
          setAssignedTasks(tasks);
          // Default all to "unassigned" (null).
          const initial: Record<string, string | null> = {};
          tasks.forEach((t) => { initial[t.id] = null; });
          setReassignments(initial);
          setPhase("reassign");
        } else {
          setPhase("simple");
        }
      } catch {
        toast.error("Failed to check assigned tasks.");
        onClose();
      }
    }
    void check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleConfirm() {
    setPhase("confirming");
    try {
      if (assignedTasks.length > 0) {
        const body = {
          reassignments: assignedTasks.map((t) => ({
            taskId: t.id,
            newAssigneeId: reassignments[t.id] ?? null,
          })),
        };
        await projectsApi.members.remove(projectId, member.userId, body);
      }
      // For simple case the first call already performed the removal; no
      // second call needed — the backend DELETE is idempotent here.
      toast.success(`${member.name} removed from project`);
      onRemoved(member.userId);
      onClose();
    } catch {
      toast.error("Failed to remove member.");
      setPhase(assignedTasks.length > 0 ? "reassign" : "simple");
    }
  }

  const loading = phase === "checking" || phase === "confirming";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent showCloseButton={false} className="w-[540px] gap-0 rounded-[14px] p-0 shadow-[0px_1px_2px_rgba(0,0,0,0.05),0px_12px_16px_rgba(0,0,0,0.10)]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pb-0 pt-6">
          <div className="flex flex-col gap-1">
            <DialogTitle className="font-display text-[20px] font-semibold leading-normal text-foreground">
              Remove {member.name}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-5 text-text-muted">
              {phase === "checking"
                ? "Checking for assigned tasks…"
                : assignedTasks.length > 0
                ? `Reassign their ${assignedTasks.length} task${assignedTasks.length !== 1 ? "s" : ""} before removing them from this project.`
                : `This will remove ${member.name} from the project. This action cannot be undone.`}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="mt-0.5 flex size-[18px] items-center justify-center rounded text-text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40 motion-reduce:transition-none"
            aria-label="Close"
          >
            <X className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>

        {/* Task reassignment list (only shown in reassign phase) */}
        {phase === "reassign" && assignedTasks.length > 0 && (
          <div className="mt-[18px] flex flex-col gap-2 px-6">
            {assignedTasks.map((task) => (
              <div
                key={task.id}
                className="flex h-[60px] items-center gap-3 rounded-[10px] border border-border bg-card px-[14px] py-[10px]"
              >
                {/* Task info */}
                <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {task.title}
                  </span>
                  <span className="text-[12px] leading-4 text-text-muted">In Progress</span>
                </div>

                {/* Reassign select */}
                <div className="w-[180px] shrink-0">
                  <Select
                    value={reassignments[task.id] ?? "__unassigned__"}
                    onValueChange={(val) =>
                      setReassignments((prev) => ({
                        ...prev,
                        [task.id]: val === "__unassigned__" ? null : val,
                      }))
                    }
                  >
                    <SelectTrigger className="h-[36px] w-full text-[13px]">
                      <SelectValue placeholder="Reassign or unassign">
                        {reassignments[task.id]
                          ? (remainingMembers.find((m) => m.userId === reassignments[task.id])?.name ?? "Reassign or unassign")
                          : <span className="text-text-muted">Reassign or unassign</span>}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">
                        <span className="text-text-muted">Leave unassigned</span>
                      </SelectItem>
                      {remainingMembers.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}

        {phase === "checking" && <RemoveMemberCheckSkeleton />}

        {/* Footer */}
        <div className="flex items-center justify-end gap-[10px] px-6 pb-5 pt-[18px]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            <ButtonPendingLabel
              pending={phase === "confirming"}
              label="Remove member"
              pendingLabel="Removing…"
            />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

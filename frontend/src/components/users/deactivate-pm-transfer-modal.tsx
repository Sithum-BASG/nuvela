"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { deactivateUser } from "@/lib/users-api";
import { ApiError } from "@/lib/api-client";
import type { OrgUser, ProjectStub } from "@/lib/users-api.types";

type Props = {
  // The user being deactivated (null = closed)
  user: OrgUser | null;
  // Projects that need a new PM, returned by the first deactivate call
  projects: ProjectStub[];
  // Active PMs available to take over (excluding the user being deactivated)
  availablePMs: OrgUser[];
  onClose: () => void;
  onDeactivated: (userId: string) => void;
};

export function DeactivatePmTransferModal({
  user,
  projects,
  availablePMs,
  onClose,
  onDeactivated,
}: Props) {
  // Map projectId → chosen new PM id
  const [transfers, setTransfers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function setTransfer(projectId: string, newManagerId: string) {
    setTransfers((prev) => ({ ...prev, [projectId]: newManagerId }));
  }

  function allAssigned() {
    return projects.every((p) => transfers[p.id]);
  }

  async function handleConfirm() {
    if (!user || !allAssigned()) return;
    setLoading(true);
    try {
      const payload = projects.map((p) => ({ projectId: p.id, newManagerId: transfers[p.id] }));
      await deactivateUser(user.id, payload);
      toast.success(`${user.name} has been deactivated`);
      onDeactivated(user.id);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error("You don't have permission to deactivate this user.");
      } else {
        toast.error("Failed to deactivate user. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!user && projects.length > 0} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="w-[480px] gap-0 rounded-[14px] p-0 shadow-[0px_1px_2px_rgba(0,0,0,0.05),0px_12px_16px_rgba(0,0,0,0.10)]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pb-4 pt-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/10">
              <AlertTriangle className="size-4 text-warning" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-display text-[20px] font-semibold leading-normal text-foreground">
                Reassign projects
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-5 text-text-secondary">
                {user?.name} is the PM on {projects.length === 1 ? "a project" : `${projects.length} projects`}. Assign a new PM before deactivating.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded text-text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Close"
          >
            <X className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>

        {/* Project transfer rows */}
        <div className="flex flex-col gap-3 px-6 pb-2">
          {projects.map((project) => (
            <div key={project.id} className="flex flex-col gap-[7px]">
              <Label className="text-[13px] font-medium text-foreground">{project.name}</Label>
              <Select
                value={transfers[project.id] ?? ""}
                onValueChange={(v) => v && setTransfer(project.id, v)}
              >
                <SelectTrigger
                  className={!transfers[project.id] ? "border-warning/60" : ""}
                  aria-label={`New PM for ${project.name}`}
                >
                  <SelectValue placeholder="Select new project manager" />
                </SelectTrigger>
                <SelectContent>
                  {availablePMs.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No available project managers
                    </SelectItem>
                  ) : (
                    availablePMs.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-[10px] px-6 pb-5 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={loading || !allAssigned()}
            onClick={handleConfirm}
          >
            <ButtonPendingLabel
              pending={loading}
              label="Deactivate user"
              pendingLabel="Deactivating…"
            />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { projectsApi } from "@/lib/projects-api";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS, DEFAULT_PROJECT_COLOR } from "@/lib/project-colors";
import type { ProjectRow } from "@/lib/projects-api.types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectRow) => void;
};

export function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_PROJECT_COLOR);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Project name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const project = await projectsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      toast.success(`${project.name} created`);
      onCreated(project);
      handleClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error("You don't have permission to create projects.");
      } else {
        toast.error("Failed to create project. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setName("");
    setDescription("");
    setColor(DEFAULT_PROJECT_COLOR);
    setErrors({});
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-[440px] gap-0 rounded-[14px] p-0 shadow-[0px_1px_2px_rgba(0,0,0,0.05),0px_12px_16px_rgba(0,0,0,0.10)]">
        <form onSubmit={handleSubmit} noValidate>
          {/* Header */}
          <div className="flex items-start justify-between px-6 pb-5 pt-6">
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-display text-[20px] font-semibold leading-normal text-foreground">
                Create project
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-5 text-text-secondary">
                Set up a new project for your team.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-0.5 flex size-[18px] items-center justify-center rounded text-text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Close"
            >
              <X className="size-[18px]" strokeWidth={1.75} />
            </button>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-5 px-6">
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="cp-name" className="text-[13px] font-medium text-foreground">
                Project name
              </Label>
              <Input
                id="cp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q3 Marketing Site"
                autoComplete="off"
                aria-describedby={errors.name ? "cp-name-err" : undefined}
                className={errors.name ? "border-destructive focus-visible:ring-destructive/30" : ""}
              />
              {errors.name && (
                <p id="cp-name-err" className="text-[12px] text-destructive">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="cp-desc" className="text-[13px] font-medium text-foreground">
                Description
              </Label>
              <textarea
                id="cp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description…"
                rows={3}
                className="min-h-[88px] w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>

            <div className="flex flex-col gap-[7px]">
              <Label className="text-[13px] font-medium text-foreground">Color</Label>
              <div className="flex items-center gap-2" role="radiogroup" aria-label="Project color">
                {PROJECT_COLORS.map((c) => {
                  const selected = c.value === color;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={c.name}
                      onClick={() => setColor(c.value)}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95 motion-reduce:transition-none",
                        selected && "ring-2 ring-offset-2 ring-offset-card",
                      )}
                      style={selected ? { "--tw-ring-color": c.value } as React.CSSProperties : undefined}
                    >
                      <span
                        className="size-[26px] rounded-full"
                        style={{ backgroundColor: c.value }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-[10px] px-6 pb-5 pt-[24px]">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <ButtonPendingLabel pending={loading} label="Create project" pendingLabel="Creating…" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

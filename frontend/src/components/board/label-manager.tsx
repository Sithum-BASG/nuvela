"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus, X, Check, Tag } from "lucide-react";

import { tasksApi } from "@/lib/tasks-api";
import type { LabelRow } from "@/lib/tasks-api.types";
import { cn } from "@/lib/utils";
import { LabelListSkeleton } from "@/components/ui/loading-states";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { EmptyState } from "@/components/ui/empty-state";

type Props = {
  projectId: string;
  taskId: string;
  appliedLabels: LabelRow[];
  isPm: boolean;
  onLabelsChanged: (labels: LabelRow[]) => void;
};

// Preset colors for new labels
const PRESET_COLORS = [
  "#7c74d6", "#6687e8", "#4ba7a0",
  "#2f855a", "#b7791f", "#c53030",
  "#d63884", "#8b5cf6", "#0ea5e9",
];

export function LabelManager({
  projectId,
  taskId,
  appliedLabels,
  isPm,
  onLabelsChanged,
}: Props) {
  const [projectLabels, setProjectLabels] = useState<LabelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Load project labels when popover opens
  useEffect(() => {
    if (!open) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    tasksApi.labels
      .list(projectId)
      .then(setProjectLabels)
      .catch(() => toast.error("Failed to load labels."))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const appliedIds = new Set(appliedLabels.map((l) => l.id));

  async function toggleLabel(label: LabelRow) {
    const isApplied = appliedIds.has(label.id);
    try {
      if (isApplied) {
        await tasksApi.labels.remove(taskId, label.id);
        onLabelsChanged(appliedLabels.filter((l) => l.id !== label.id));
      } else {
        await tasksApi.labels.apply(taskId, label.id);
        onLabelsChanged([...appliedLabels, label]);
      }
    } catch {
      toast.error(`Failed to ${isApplied ? "remove" : "apply"} label.`);
    }
  }

  async function createLabel() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const label = await tasksApi.labels.create(projectId, {
        name: newName.trim(),
        color: newColor,
      });
      setProjectLabels((prev) => [...prev, label]);
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
      setCreating(false);
    } catch {
      toast.error("Failed to create label.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLabel(label: LabelRow) {
    try {
      await tasksApi.labels.delete(label.id);
      setProjectLabels((prev) => prev.filter((l) => l.id !== label.id));
      if (appliedIds.has(label.id)) {
        onLabelsChanged(appliedLabels.filter((l) => l.id !== label.id));
      }
    } catch {
      toast.error("Failed to delete label.");
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      {/* Applied labels + add button */}
      <div className="flex flex-wrap items-center gap-1.5">
        {appliedLabels.map((label) => (
          <span
            key={label.id}
            className="inline-flex h-[22px] items-center gap-1 rounded-[5px] px-2 text-[12px] font-medium text-white"
            style={{ backgroundColor: label.color }}
          >
            {label.name}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => void toggleLabel(label)}
              className="ml-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none"
              aria-label={`Remove label ${label.name}`}
            >
              <X className="size-[10px]" strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-[22px] items-center gap-1 rounded-[5px] border border-dashed border-border px-2 text-[12px] text-text-muted transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Plus className="size-[11px]" strokeWidth={2.5} />
          Add label
        </button>
      </div>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[220px] rounded-[10px] border border-border bg-card shadow-lg">
          <div className="p-2">
            {loading ? (
              <LabelListSkeleton />
            ) : projectLabels.length === 0 && !creating ? (
              <EmptyState
                icon={Tag}
                title="No labels yet"
                size="compact"
                className="py-3"
              />
            ) : (
              <div className="flex flex-col gap-0.5">
                {projectLabels.map((label) => {
                  const applied = appliedIds.has(label.id);
                  return (
                    <div
                      key={label.id}
                      className="group flex items-center gap-2 rounded-[6px] px-2 py-1.5 hover:bg-surface-muted"
                    >
                      <button
                        onClick={() => void toggleLabel(label)}
                        className="flex flex-1 items-center gap-2 text-left focus-visible:outline-none"
                      >
                        <span
                          className="size-3 shrink-0 rounded-[3px]"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="flex-1 truncate text-[13px] text-foreground">
                          {label.name}
                        </span>
                        {applied && (
                          <Check className="size-[12px] shrink-0 text-success" strokeWidth={2.5} />
                        )}
                      </button>
                      {isPm && (
                        <button
                          onClick={() => void deleteLabel(label)}
                          className="flex size-5 shrink-0 items-center justify-center rounded-[4px] text-text-muted opacity-0 transition-opacity hover:bg-danger-tint hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label={`Delete label ${label.name}`}
                        >
                          <X className="size-[10px]" strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create new label (PM only) */}
            {isPm && (
              <>
                {creating ? (
                  <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void createLabel();
                        if (e.key === "Escape") setCreating(false);
                      }}
                      placeholder="Label name"
                      className="w-full rounded-[6px] border border-input bg-background px-2 py-1 text-[12px] text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                    {/* Color swatches */}
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewColor(c)}
                          className={cn(
                            "size-5 rounded-[4px] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            newColor === c && "ring-2 ring-offset-1 ring-foreground/40",
                          )}
                          style={{ backgroundColor: c }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => void createLabel()}
                        disabled={!newName.trim() || saving}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-[6px] bg-primary py-1 text-[12px] font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <InlineSpinner className="size-3" />
                            Saving…
                          </>
                        ) : (
                          "Create"
                        )}
                      </button>
                      <button
                        onClick={() => setCreating(false)}
                        className="flex-1 rounded-[6px] border border-border py-1 text-[12px] text-text-secondary hover:bg-surface-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreating(true)}
                    className="mt-1 flex w-full items-center gap-1.5 rounded-[6px] border-t border-border px-2 pt-2 text-[12px] text-text-secondary hover:text-primary focus-visible:outline-none"
                  >
                    <Plus className="size-[11px]" strokeWidth={2.5} />
                    New label
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

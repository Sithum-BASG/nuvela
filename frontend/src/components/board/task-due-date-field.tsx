"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { tasksApi } from "@/lib/tasks-api";
import type { TaskRow } from "@/lib/tasks-api.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  task: TaskRow;
  isPm: boolean;
  onUpdated: (task: TaskRow) => void;
};

function toInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd");
}

function toDateValue(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function TaskDueDateField({ task, isPm, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedDate = useMemo(() => toDateValue(draft), [draft]);
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    selectedDate ?? new Date(),
  );

  useEffect(() => {
    // Sync editable state when the task's due date changes (e.g. after a save).
    setDraft(toInputValue(task.dueDate)); // eslint-disable-line react-hooks/set-state-in-effect
    setVisibleMonth(toDateValue(toInputValue(task.dueDate)) ?? new Date());
  }, [task.dueDate]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDraft(toInputValue(task.dueDate));
        setVisibleMonth(toDateValue(toInputValue(task.dueDate)) ?? new Date());
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, task.dueDate]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    });
  }, [visibleMonth]);

  if (!isPm && !task.dueDate) return null;

  async function saveDueDate(value: string | null) {
    setSaving(true);
    try {
      const updated = await tasksApi.tasks.update(task.id, { dueDate: value });
      onUpdated(updated);
      setOpen(false);
      toast.success(value ? "Due date updated." : "Due date cleared.");
    } catch {
      toast.error("Failed to update due date.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <div className="flex items-center gap-3 rounded-control bg-surface-muted px-2.5 py-2">
        <span className="w-[110px] shrink-0 text-[13px] text-text-muted">
          Due date
        </span>
        <span
          className={cn(
            "flex flex-1 items-center gap-1.5 text-[13px] font-medium",
            task.dueDate ? "text-foreground" : "text-text-muted",
          )}
        >
          {task.dueDate ? (
            <>
              <Calendar className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {format(new Date(task.dueDate), "MMM d, yyyy")}
            </>
          ) : (
            "No due date"
          )}
        </span>
        {isPm && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-text-muted transition-colors hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-white/10"
            aria-label={task.dueDate ? "Edit due date" : "Set due date"}
          >
            <Pencil className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      {open && isPm && (
        <div className="absolute top-full right-0 z-10 mt-2 w-[min(100vw-3rem,320px)] rounded-xl border border-border bg-card p-3 shadow-lg ring-1 ring-foreground/5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
              className="flex size-8 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </button>
            <div className="text-center">
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-text-muted">
                Due date
              </p>
              <p className="font-display text-base font-semibold text-foreground">
                {format(visibleMonth, "MMMM yyyy")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              className="flex size-8 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span
                key={day}
                className="flex h-8 items-center justify-center text-[11px] font-medium uppercase tracking-wide text-text-muted"
              >
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isSelected =
                selectedDate !== null && isSameDay(day, selectedDate);
              const inMonth = isSameMonth(day, visibleMonth);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setDraft(format(day, "yyyy-MM-dd"))}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-control text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : inMonth
                        ? "text-foreground hover:bg-surface-muted"
                        : "text-text-muted/50 hover:bg-surface-muted/60",
                    isToday(day) &&
                      !isSelected &&
                      "ring-1 ring-inset ring-primary/35",
                  )}
                  aria-pressed={isSelected}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-text-muted"
              disabled={!task.dueDate || saving}
              onClick={() => void saveDueDate(null)}
            >
              <X className="size-3.5" />
              Clear
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setDraft(toInputValue(task.dueDate));
                setVisibleMonth(
                  toDateValue(toInputValue(task.dueDate)) ?? new Date(),
                );
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving || !draft}
                onClick={() => void saveDueDate(draft)}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

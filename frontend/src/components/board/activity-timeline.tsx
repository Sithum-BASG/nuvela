"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRightLeft,
  CheckSquare,
  MessageSquare,
  Paperclip,
  UserMinus,
  UserPlus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { activityApi, type ActivityRow } from "@/lib/activity-api";
import { cn } from "@/lib/utils";
import { ActivityRowSkeleton } from "@/components/ui/loading-states";

type Props = {
  taskId: string;
  refreshKey?: number;
};

function describeActivity(row: ActivityRow): string {
  const name = row.actor.name;
  const meta = row.metadata ?? {};

  switch (row.type) {
    case "STATUS_CHANGED":
      return `${name} moved this task`;
    case "ASSIGNED":
      return `${name} assigned someone`;
    case "UNASSIGNED":
      return `${name} unassigned someone`;
    case "FIELD_CHANGED":
      return `${name} updated this task`;
    case "CHECKLIST_CHECKED":
      return `${name} checked a checklist item`;
    case "CHECKLIST_UNCHECKED":
      return `${name} unchecked a checklist item`;
    case "ATTACHMENT_ADDED":
      return `${name} attached ${String(meta.fileName ?? "a file")}`;
    case "COMMENT_ADDED":
      return `${name} commented`;
    default:
      return `${name} updated this task`;
  }
}

function activityIcon(type: ActivityRow["type"]) {
  switch (type) {
    case "STATUS_CHANGED":
      return ArrowRightLeft;
    case "ASSIGNED":
      return UserPlus;
    case "UNASSIGNED":
      return UserMinus;
    case "FIELD_CHANGED":
      return Pencil;
    case "CHECKLIST_CHECKED":
    case "CHECKLIST_UNCHECKED":
      return CheckSquare;
    case "ATTACHMENT_ADDED":
      return Paperclip;
    case "COMMENT_ADDED":
      return MessageSquare;
    default:
      return Pencil;
  }
}

export function ActivityTimeline({ taskId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    activityApi
      .list(taskId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load activity.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, refreshKey]);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        Activity
      </span>

      {loading ? (
        <ActivityRowSkeleton count={3} />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-text-muted">No activity yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-0 pl-1">
          {rows.map((row, index) => {
            const Icon = activityIcon(row.type);
            return (
              <li key={row.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < rows.length - 1 && (
                  <span
                    className="absolute left-[13px] top-7 bottom-0 w-px bg-border"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "relative z-[1] flex size-[26px] shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-muted",
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[13px] text-foreground">
                    {describeActivity(row)}
                  </p>
                  <time
                    dateTime={row.createdAt}
                    className="text-[12px] text-text-muted"
                  >
                    {formatDistanceToNow(new Date(row.createdAt), {
                      addSuffix: true,
                    })}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

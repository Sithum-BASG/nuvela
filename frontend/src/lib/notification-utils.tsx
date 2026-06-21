import type { ReactNode } from "react";
import {
  ArrowRightLeft,
  AtSign,
  Clock,
  UserPlus,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

import type { NotificationRow, NotificationType } from "@/lib/notifications-api";

export function notificationIcon(type: NotificationType): {
  icon: LucideIcon;
  className: string;
} {
  switch (type) {
    case "DEADLINE":
      return { icon: Clock, className: "bg-warning-tint text-warning" };
    case "MENTION":
      return { icon: AtSign, className: "bg-primary/10 text-primary" };
    case "STATUS_CHANGED":
      return { icon: ArrowRight, className: "bg-primary/10 text-primary" };
    case "PROJECT_TRANSFERRED":
      return { icon: ArrowRightLeft, className: "bg-primary/10 text-primary" };
    default:
      return { icon: UserPlus, className: "bg-primary/10 text-primary" };
  }
}

export function notificationLabel(row: NotificationRow): ReactNode {
  const payload = row.payload;
  const title = String(payload.title ?? "a task");
  const name = String(payload.name ?? "A project");

  switch (row.type) {
    case "TASK_ASSIGNED":
      return (
        <>
          You were assigned <span className="font-medium text-foreground">{title}</span>
        </>
      );
    case "STATUS_CHANGED":
      return (
        <>
          <span className="font-medium text-foreground">{title}</span> was moved to a new
          column
        </>
      );
    case "MENTION":
      return <>You were mentioned in a comment on a task</>;
    case "DEADLINE": {
      const kind = payload.kind === "overdue" ? "is overdue" : "is due within 24 hours";
      return (
        <>
          <span className="font-medium text-foreground">{title}</span> {kind}
        </>
      );
    }
    case "PROJECT_TRANSFERRED":
      return (
        <>
          <span className="font-medium text-foreground">{name}</span> was transferred
        </>
      );
    default:
      return "New notification";
  }
}

export function notificationHref(row: NotificationRow): string {
  const projectId = row.payload.projectId;
  const taskId = row.payload.taskId;
  if (typeof projectId !== "string") return "/notifications";
  if (row.type === "PROJECT_TRANSFERRED") return `/projects/${projectId}`;
  if (typeof taskId === "string") return `/projects/${projectId}?task=${taskId}`;
  return `/projects/${projectId}`;
}

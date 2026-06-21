"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import type { NotificationRow } from "@/lib/notifications-api";
import {
  notificationHref,
  notificationIcon,
  notificationLabel,
} from "@/lib/notification-utils";
import { cn } from "@/lib/utils";

type Props = {
  row: NotificationRow;
  onSelect?: (row: NotificationRow) => void;
  className?: string;
};

export function NotificationItemRow({ row, onSelect, className }: Props) {
  const { icon: Icon, className: iconClass } = notificationIcon(row.type);
  const href = notificationHref(row);

  const content = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          iconClass,
        )}
        aria-hidden
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-[18px] text-text-secondary">
          {notificationLabel(row)}
        </span>
        <span className="mt-0.5 block text-xs text-text-muted">
          {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
        </span>
      </span>
      {!row.isRead && (
        <span
          className="mt-1 size-2.5 shrink-0 rounded-full bg-primary"
          aria-label="Unread"
        />
      )}
    </>
  );

  const rowClass = cn(
    "flex w-full items-start gap-3 rounded-[10px] px-3.5 py-3 text-left transition-colors motion-reduce:transition-none",
    row.isRead ? "bg-card hover:bg-muted/40" : "bg-primary/5 hover:bg-primary/10",
    className,
  );

  if (onSelect) {
    return (
      <button type="button" className={rowClass} onClick={() => onSelect(row)}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={rowClass}>
      {content}
    </Link>
  );
}

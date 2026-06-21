"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NotificationItemRow } from "@/components/app/notification-item";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { NotificationListSkeleton } from "@/components/ui/loading-states";
import { notificationHref } from "@/lib/notification-utils";
import type { NotificationRow } from "@/lib/notifications-api";
import { useNotifications } from "@/providers/socket-provider";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const router = useRouter();
  const { items, loading, unreadCount, refresh, markRead, markAllRead } =
    useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible =
    filter === "unread" ? items.filter((item) => !item.isRead) : items;

  async function handleSelect(row: NotificationRow) {
    if (!row.isRead) await markRead(row.id);
    router.push(notificationHref(row));
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-6">
      <PageHeader
        title="Notifications"
        subtitle="Updates about tasks, mentions, and project changes."
        action={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-2">
        {(["all", "unread"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-control px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none",
              filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-text-secondary hover:text-foreground",
            )}
          >
            {key === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {loading ? (
        <NotificationListSkeleton />
      ) : visible.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-text-muted">
            {filter === "unread"
              ? "No unread notifications."
              : "No notifications yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((row) => (
            <NotificationItemRow
              key={row.id}
              row={row}
              onSelect={(item) => void handleSelect(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

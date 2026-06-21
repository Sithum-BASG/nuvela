"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { NotificationItemRow } from "@/components/app/notification-item";
import { Button } from "@/components/ui/button";
import { NotificationDropdownSkeleton } from "@/components/ui/loading-states";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationRow } from "@/lib/notifications-api";
import { notificationHref } from "@/lib/notification-utils";
import { useNotifications } from "@/providers/socket-provider";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const router = useRouter();
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const recent = items.slice(0, 8);
  const badge =
    unreadCount > 9 ? "9+" : unreadCount > 0 ? String(unreadCount) : null;

  async function handleSelect(row: NotificationRow) {
    if (!row.isRead) await markRead(row.id);
    router.push(notificationHref(row));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "relative inline-flex size-9 items-center justify-center rounded-control text-foreground outline-none",
          "hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
        aria-label="Notifications"
      >
        <Bell className="size-4" strokeWidth={1.75} />
        {badge && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {badge}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[360px] overflow-hidden rounded-[12px] p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">Notifications</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-[13px] font-medium text-primary hover:text-primary"
              onClick={() => void markAllRead()}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <div className="max-h-[280px] overflow-y-auto p-2">
          {loading ? (
            <NotificationDropdownSkeleton />
          ) : recent.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-text-muted">
              You&apos;re all caught up.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {recent.map((row) => (
                <NotificationItemRow
                  key={row.id}
                  row={row}
                  onSelect={(item) => void handleSelect(item)}
                />
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";

import {
  notificationsApi,
  type NotificationRow,
} from "@/lib/notifications-api";
import { notificationLabel } from "@/lib/notification-utils";
import { useAuth } from "@/providers/auth-provider";

type SocketContextValue = {
  items: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const SocketContext = createContext<SocketContextValue | null>(null);

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items],
  );

  const refresh = useCallback(async () => {
    const rows = await notificationsApi.list();
    setItems(rows);
  }, []);

  const markRead = useCallback(async (id: string) => {
    await notificationsApi.markRead(id);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for initial REST fetch
    setLoading(true);
    void refresh()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const socket = io(BACKEND, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("notification", (row: NotificationRow) => {
      setItems((prev) => {
        if (prev.some((item) => item.id === row.id)) return prev;
        return [row, ...prev];
      });
      toast(notificationLabel(row), {
        duration: 5000,
      });
    });

    return () => {
      cancelled = true;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [status, refresh]);

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead }),
    [items, unreadCount, loading, refresh, markRead, markAllRead],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useNotifications(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useNotifications must be used inside SocketProvider");
  }
  return ctx;
}

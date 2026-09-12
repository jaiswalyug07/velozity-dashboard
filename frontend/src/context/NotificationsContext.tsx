import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { useRealtime } from "./RealtimeContext";
import type { Notification } from "../types";

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  open: boolean;
  setOpen: (o: boolean) => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { socket, connected } = useRealtime();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        api.get<{ data: Notification[] }>("/api/notifications", { params: { limit: 30 } }),
        api.get<{ data: { count: number } }>("/api/notifications/unread-count"),
      ]);
      setNotifications(list.data.data);
      setUnreadCount(count.data.data.count);
    } catch {
      /* ignore; interceptor handles auth */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    void refresh();

    if (!socket) return;

    const onNew = (n: Notification) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50));
      setUnreadCount((c) => (n.isRead ? c : c + 1));
    };
    const onUnread = (count: number) => setUnreadCount(count);

    socket.on("notification:new", onNew);
    socket.on("notification:unread", onUnread);
    return () => {
      socket.off("notification:new", onNew);
      socket.off("notification:unread", onUnread);
    };
  }, [user, socket, refresh]);

  // On reconnect, re-sync the count so missed notifications aren't lost forever.
  useEffect(() => {
    if (connected && user) {
      api
        .get<{ data: { count: number } }>("/api/notifications/unread-count")
        .then((res) => setUnreadCount(res.data.data.count))
        .catch(() => {});
    }
  }, [connected, user]);

  const markRead = useCallback(async (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await api.patch(`/api/notifications/${id}/read`).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await api.patch("/api/notifications/read-all").catch(() => {});
  }, []);

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount, loading, open, setOpen, markRead, markAllRead, refresh }),
    [notifications, unreadCount, loading, open, setOpen, markRead, markAllRead, refresh]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import type { ActivityEvent } from "../types";

interface Options {
  maxItems?: number;
  /** Only listen for new events when the document is mounted (e.g. project feed) */
  active?: boolean;
}

/**
 * Role-filtered live activity feed.
 * - Initial data comes from GET /api/activity (server filters by role).
 * - New events arrive over WebSocket and are prepended (deduped by id).
 * - If the socket was down when events occurred, on reconnect we fetch
 *   /api/activity?after=<lastId> so the missed events are recovered from the
 *   database (not from memory) and merged at the bottom of the feed.
 */
export function useActivityFeed({ maxItems = 40, active = true }: Options = {}) {
  const { user } = useAuth();
  const { socket, connected } = useRealtime();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const lastId = useRef<number | null>(null);
  const wasDisconnected = useRef(false);

  const fetch = useCallback(
    async (after?: number) => {
      if (!user) return;
      try {
        const res = await api.get<{ data: ActivityEvent[] }>("/api/activity", {
          params: after ? { after, limit: 30 } : { limit: maxItems },
        });
        const items = res.data.data;
        if (items.length) lastId.current = Math.max(lastId.current ?? 0, items[items.length - 1]!.id);
        return items;
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, maxItems]
  );

  useEffect(() => {
    lastId.current = null;
    setEvents([]);
    setLoading(true);
    void fetch().then((items) => {
      if (items) setEvents([...items].reverse());
    });
  }, [fetch]);

  useEffect(() => {
    if (!active || !socket || !user) return;

    const onActivity = (evt: ActivityEvent) => {
      if (lastId.current !== null && evt.id <= lastId.current) return;
      lastId.current = evt.id;
      setEvents((prev) => [evt, ...prev.filter((e) => e.id !== evt.id)].slice(0, maxItems));
    };

    socket.on("activity:new", onActivity);
    return () => {
      socket.off("activity:new", onActivity);
    };
  }, [socket, active, user, maxItems]);

  // Catch up missed events after any socket reconnection. Discovery is done
  // via the database (GET /api/activity?after=<lastId>), never from memory.
  useEffect(() => {
    if (!active || !socket) return;
    if (connected) {
      if (wasDisconnected.current) {
        void fetch(lastId.current ?? undefined).then((items) => {
          if (items && items.length) {
            const afterDesc = [...items].reverse(); // newest first
            setEvents((prev) => {
              const merged = [...afterDesc, ...prev.filter((e) => !afterDesc.some((a) => a.id === e.id))];
              return merged.slice(0, maxItems);
            });
          }
        });
      }
      wasDisconnected.current = false;
    } else {
      wasDisconnected.current = true;
    }
  }, [connected, active, socket, fetch, maxItems]);

  return { events, loading };
}
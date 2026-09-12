import { useEffect } from "react";
import { useRealtime } from "../context/RealtimeContext";

/**
 * Joins (and leaves) a Socket.IO project room so the socket receives
 * `task:updated` and project-scoped `activity:new` events while the caller
 * is mounted. Used on the project detail page.
 */
export function useProjectRoom(projectId: number | null | undefined) {
  const { socket, connected } = useRealtime();

  useEffect(() => {
    if (!socket || !connected || !projectId) return;
    socket.emit("room:join", { projectId });
    return () => {
      socket.emit("room:leave", { projectId });
    };
  }, [socket, connected, projectId]);
}
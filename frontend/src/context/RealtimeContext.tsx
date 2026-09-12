import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSocket, type ClientSocket } from "../lib/socket";
import { useAuth } from "./AuthContext";
import type { PresencePayload } from "../types";

interface RealtimeContextValue {
  socket: ClientSocket | null;
  connected: boolean;
  onlineCount: number;
  onlineUsers: { id: number }[];
  presenceReady: boolean;
  recentJoins: { id: number; name: string; role: string }[];
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<{ id: number }[]>([]);
  const [presenceReady, setPresenceReady] = useState(false);
  const [recentJoins, setRecentJoins] = useState<{ id: number; name: string; role: string }[]>([]);
  const [socket, setSocket] = useState<ClientSocket | null>(null);

  useEffect(() => {
    if (!user) {
      setConnected(false);
      setSocket(null);
      return;
    }

    const s = getSocket();
    setSocket(s);

    const onConnect = () => {
      setConnected(true);
      setPresenceReady(false);
    };
    const onDisconnect = () => setConnected(false);
    const onPresence = (p: PresencePayload) => {
      setOnlineCount(p.count);
      setOnlineUsers(p.users);
      setPresenceReady(true);
    };
    const onUserConnected = (u: { id: number; name: string; role: string }) => {
      setRecentJoins((prev) => [{ ...u, at: Date.now() }, ...prev].slice(0, 6));
      setTimeout(() => setRecentJoins((prev) => prev.filter((x) => x !== u)), 8000);
    };

    if (!s.connected) s.connect();
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("presence:update", onPresence);
    s.on("user:connected", onUserConnected);
    if (s.connected) {
      setConnected(true);
      setPresenceReady(false);
    }

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("presence:update", onPresence);
      s.off("user:connected", onUserConnected);
    };
  }, [user]);

  const value = useMemo<RealtimeContextValue>(
    () => ({ socket, connected, onlineCount, onlineUsers, presenceReady, recentJoins }),
    [socket, connected, onlineCount, onlineUsers, presenceReady, recentJoins]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}
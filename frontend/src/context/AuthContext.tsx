import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tryRefresh, setAccessToken, onAuthExpired } from "../lib/api";
import { disconnectSocket } from "../lib/socket";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // On a cold page load there is no access token in memory, so restore a
        // session via the HttpOnly refresh cookie first.
        const token = await tryRefresh();
        if (cancelled) return;
        if (!token) return;

        const { data } = await api.get<{ data: User }>("/api/auth/me");
        if (!cancelled) setUser(data.data);
      } catch {
        /* not logged in */
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onAuthExpired(() => {
      setUser(null);
      disconnectSocket();
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ data: { accessToken: string; user: User } }>("/api/auth/login", {
      email,
      password,
    });
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, initializing, login, logout, setUser }),
    [user, initializing, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
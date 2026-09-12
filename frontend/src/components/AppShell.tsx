import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { NotificationBell } from "./NotificationBell";
import type { Role } from "../types";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  DEVELOPER: "Developer",
};

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  ADMIN: [
    { to: "/", label: "Dashboard", end: true },
    { to: "/projects", label: "Projects" },
    { to: "/tasks", label: "Tasks" },
    { to: "/clients", label: "Clients" },
    { to: "/users", label: "Users" },
  ],
  PROJECT_MANAGER: [
    { to: "/", label: "Dashboard", end: true },
    { to: "/projects", label: "Projects" },
    { to: "/tasks", label: "Tasks" },
    { to: "/clients", label: "Clients" },
  ],
  DEVELOPER: [
    { to: "/", label: "Dashboard", end: true },
    { to: "/tasks", label: "My Tasks" },
    { to: "/projects", label: "Projects" },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { connected, onlineCount, presenceReady } = useRealtime();
  const navigate = useNavigate();

  if (!user) return <>{children}</>;

  const nav = NAV_BY_ROLE[user.role] ?? [];
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">V</span>
          <span className="brand-name">Velozity</span>
        </div>

        <nav className="nav">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          {user.role === "ADMIN" && (
            <div className="presence-chip" title="Live online user count (via WebSocket presence)">
              <span className={`status-dot ${connected ? "on" : ""}`} />
              {presenceReady ? `${onlineCount} online` : "presence…"}
            </div>
          )}
          <div className="user-chip">
            <span className="avatar">{initials}</span>
            <span className="user-chip-name">
              <strong>{user.name}</strong>
              <small>{ROLE_LABEL[user.role]}</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="conn-indicator" title={connected ? "Connected to realtime server" : "Disconnected (events will be caught up)"}>
            <span className={`status-dot ${connected ? "on" : ""}`} />
            {connected ? "Live" : "Reconnecting…"}
          </div>
          <div className="topbar-right">
            <NotificationBell />
            <button className="btn btn-ghost btn-sm" onClick={() => void logout().then(() => navigate("/login"))}>
              Sign out
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
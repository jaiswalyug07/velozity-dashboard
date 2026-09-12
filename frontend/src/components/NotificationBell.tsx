import { useEffect, useRef } from "react";
import { useNotifications } from "../context/NotificationsContext";
import { relativeTime } from "../lib/format";
import { Link } from "react-router-dom";

export function NotificationBell() {
  const { notifications, unreadCount, open, setOpen, markRead, markAllRead, loading } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        className="notif-btn"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-drop">
          <div className="notif-head">
            <strong>Notifications</strong>
            <button className="link-btn" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              Mark all read
            </button>
          </div>
          <div className="notif-list">
            {loading && notifications.length === 0 && <div className="notif-empty">Loading…</div>}
            {!loading && notifications.length === 0 && <div className="notif-empty">You're all caught up.</div>}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`notif-item${n.isRead ? "" : " notif-unread"}`}
                onClick={() => void markRead(n.id)}
              >
                <span className="notif-msg">{n.message}</span>
                <span className="notif-time">{relativeTime(n.createdAt)}</span>
                {n.taskId != null && (
                  <Link
                    to={`/tasks?task=${n.taskId}`}
                    className="notif-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                    }}
                  >
                    Open task →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
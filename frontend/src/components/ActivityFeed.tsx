import { relativeTime } from "../lib/format";
import type { ActivityEvent, ActivityType } from "../types";
import { EmptyState, Spinner } from "./ui";

const TYPE_ICON: Record<ActivityType, string> = {
  PROJECT_CREATED: "▲",
  TASK_CREATED: "＋",
  TASK_ASSIGNED: "→",
  TASK_STATUS_CHANGED: "⇄",
  TASK_OVERDUE: "!",
};

export function ActivityFeed({
  events,
  loading,
  window,
  title,
  emptyDetail,
}: {
  events: ActivityEvent[];
  loading: boolean;
  window?: string;
  title?: string;
  emptyDetail?: string;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title ?? "Live Activity"}</h3>
        {window && <span className="panel-note">{window}</span>}
      </div>
      {loading && events.length === 0 ? (
        <Spinner label="Loading activity…" />
      ) : events.length === 0 ? (
        <EmptyState title="No activity yet" detail={emptyDetail ?? "Events will appear here in real time."} />
      ) : (
        <ul className="feed">
          {events.map((evt) => (
            <li className="feed-item" key={evt.id}>
              <span className={`feed-icon feed-${evt.type.toLowerCase()}`} aria-hidden>
                {TYPE_ICON[evt.type] ?? "•"}
              </span>
              <div className="feed-content">
                {evt.message}
                <span className="feed-meta">
                  {relativeTime(evt.createdAt)}
                  {evt.project?.name ? ` · ${evt.project.name}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
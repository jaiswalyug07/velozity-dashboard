import { formatDate, isPast } from "../lib/format";
import type { Task } from "../types";
import { OverdueBadge, PriorityBadge, StatusBadge } from "./StatusBadge";
import { Button, EmptyState } from "./ui";

interface TaskListProps {
  tasks: Task[];
  loading?: boolean;
  onEdit?: (task: Task) => void;
  /** Show quickly-update status dropdown for each task card */
  onQuickStatus?: (task: Task, status: Task["status"]) => void;
  emptyTitle?: string;
  highlightId?: number | null;
}

export function TaskList({ tasks, loading, onEdit, onQuickStatus, emptyTitle, highlightId }: TaskListProps) {
  if (loading && tasks.length === 0) {
    return <div className="task-list-skeleton">Loading tasks…</div>;
  }
  if (tasks.length === 0) {
    return <EmptyState title={emptyTitle ?? "No tasks found"} detail="Try adjusting the filters." />;
  }
  return (
    <div className="task-list">
      {tasks.map((t) => (
        <div className={`task-item${highlightId === t.id ? " task-highlight" : ""}`} key={t.id}>
          <div className="task-main">
            <div className="task-title">
              <span className="task-no">#{t.id}</span>
              {t.title}
              {t.isOverdue && <OverdueBadge />}
            </div>
            <div className="task-meta">
              <span>{t.project?.name ?? `Project #${t.projectId}`}</span>
              <span>Due {formatDate(t.dueDate)}</span>
              {isPast(t.dueDate) && t.status !== "DONE" ? <span className="muted warn">(late)</span> : null}
              {t.assignedTo ? <span>→ {t.assignedTo.name}</span> : <span className="muted">Unassigned</span>}
            </div>
          </div>
          <div className="task-side">
            <StatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} />
            {onQuickStatus && (
              <select
                className="input input-sm"
                value={t.status}
                aria-label={`Change status of task ${t.id}`}
                onChange={(e) => onQuickStatus(t, e.target.value as Task["status"])}
              >
                {(["TO_DO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const).map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            )}
            {onEdit && (
              <Button variant="ghost" className="btn-sm" onClick={() => onEdit(t)}>
                Edit
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
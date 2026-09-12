import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { useQuery } from "../hooks/useQuery";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { ActivityFeed } from "../components/ActivityFeed";
import { ErrorBanner, PageLoader, StatCard } from "../components/ui";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../lib/format";
import type { AdminDashboard, PmDashboard, DevDashboard } from "../types";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return <PageLoader />;
  switch (user.role) {
    case "ADMIN":
      return <AdminDashboard />;
    case "PROJECT_MANAGER":
      return <PmDashboardPanel />;
    case "DEVELOPER":
      return <DevDashboard />;
    default:
      return <div>No dashboard configured for your role.</div>;
  }
}

/* ──────────────────────────── Admin ──────────────────────────── */

function AdminDashboard() {
  const { onlineCount, presenceReady } = useRealtime();
  const { events, loading: feedLoading } = useActivityFeed({ maxItems: 30 });
  const { data, loading, error } = useQuery(
    () => api.get<{ data: AdminDashboard & { clients: number; developers: number } }>("/api/dashboard/admin").then((r) => r.data.data),
    []
  );

  if (loading) return <PageLoader />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  return (
    <div className="dash">
      <h1 className="page-title">Admin Dashboard</h1>
      <div className="stat-grid">
        <StatCard label="Projects" value={data.totalProjects} tone="violet" />
        <StatCard label="Tasks" value={data.totalTasks} tone="blue" />
        <StatCard label="Overdue" value={data.overdueCount} tone="red" sub={data.overdueCount > 0 ? `${data.overdueCount} task${data.overdueCount === 1 ? "" : "s"} past due` : undefined} />
        <StatCard label="Active users (live)" value={presenceReady ? onlineCount : "…"} tone="green" sub="WebSocket presence" />
        <StatCard label="Clients" value={data.clients} tone="gray" />
        <StatCard label="Developers" value={data.developers} tone="blue" />
      </div>

      <div className="dash-panels">
        <div className="dash-left">
          {data.tasksByStatus.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h3>Tasks by status</h3></div>
              <ul className="dash-list">
                {data.tasksByStatus.map((row) => (
                  <li key={row.status}>
                    <StatusBadge status={row.status} />
                    <span className="dash-list-val">{row._count._all}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.tasksByPriority.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h3>Tasks by priority</h3></div>
              <ul className="dash-list">
                {data.tasksByPriority.map((row) => (
                  <li key={row.priority}>
                    <span>{row.priority}</span>
                    <span className="dash-list-val">{row._count._all}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="dash-right">
          <ActivityFeed events={events} loading={feedLoading} title="Global live feed" emptyDetail="Events appear here in real time as your team works." />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── PM ───────────────────────── */

function PmDashboardPanel() {
  const { events, loading: feedLoading } = useActivityFeed({ maxItems: 30 });
  const { data, loading, error } = useQuery(
    () => api.get<{ data: PmDashboard }>("/api/dashboard/pm").then((r) => r.data.data),
    []
  );

  if (loading) return <PageLoader />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  return (
    <div className="dash">
      <h1 className="page-title">Project Manager Dashboard</h1>
      <div className="stat-grid">
        <StatCard label="My projects" value={data.projects.length} tone="violet" />
        <StatCard label="Tasks" value={data.totalTasks} tone="blue" />
        <StatCard label="Overdue" value={data.overdueCount} tone="red" />
      </div>

      <div className="dash-panels">
        <div className="dash-left">
          {data.projects.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h3>My projects</h3></div>
              <ul className="dash-list">
                {data.projects.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`}>{p.name}</Link>
                    <span className="dash-list-val">{p._count?.tasks ?? 0} tasks</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.tasksByPriority.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h3>Tasks by priority</h3></div>
              <ul className="dash-list">
                {data.tasksByPriority.map((row) => (
                  <li key={row.priority}>
                    <span>{row.priority}</span>
                    <span className="dash-list-val">{row._count._all}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.dueThisWeek.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h3>Due this week</h3></div>
              <ul className="dash-list">
                {data.dueThisWeek.map((t) => (
                  <li key={t.id}>
                    <span>#{t.id} {t.title}</span>
                    <span className="dash-list-val">{formatDate(t.dueDate)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="dash-right">
          <ActivityFeed events={events} loading={feedLoading} title="My projects feed" />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Dev ───────────────────────── */

function DevDashboard() {
  const { events, loading: feedLoading } = useActivityFeed({ maxItems: 30 });
  const { data, loading, error } = useQuery(
    () => api.get<{ data: DevDashboard }>("/api/dashboard/dev").then((r) => r.data.data),
    []
  );

  if (loading) return <PageLoader />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  return (
    <div className="dash">
      <h1 className="page-title">My Dashboard</h1>
      <div className="stat-grid">
        <StatCard label="My tasks" value={data.tasks.length} tone="blue" />
        <StatCard label="In progress" value={data.inProgressCount} tone="blue" />
        <StatCard label="Done" value={data.doneCount} tone="green" />
        <StatCard label="Overdue" value={data.overdueCount} tone="red" />
      </div>
      <div className="dash-panels">
        <div className="dash-left">
          <section className="panel">
            <div className="panel-head"><h3>My tasks (by priority → due date)</h3></div>
            <ul className="dash-list">
              {data.tasks.slice(0, 15).map((t) => (
                <li key={t.id} className={t.isOverdue ? "list-overdue" : ""}>
                  <span>
                    <StatusBadge status={t.status} />
                    <strong>#{t.id}</strong> {t.title}
                  </span>
                  <span className="dash-list-val">{formatDate(t.dueDate)}</span>
                </li>
              ))}
              {data.tasks.length === 0 && <li className="muted">No tasks assigned yet.</li>}
            </ul>
          </section>
        </div>
        <div className="dash-right">
          <ActivityFeed events={events} loading={feedLoading} title="My task activity" emptyDetail="Updates on tasks assigned to you." />
        </div>
      </div>
    </div>
  );
}
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "../hooks/useQuery";
import { TaskFilterBar } from "../components/TaskFilterBar";
import { TaskForm } from "../components/TaskForm";
import { TaskList } from "../components/TaskList";
import { StatCard, ErrorBanner, Button } from "../components/ui";
import type { Task } from "../types";

export default function TasksPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "PROJECT_MANAGER";

  const taskIdParam = params.get("task");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filters = useMemo(
    () => ({
      status: params.get("status") ?? undefined,
      priority: params.get("priority") ?? undefined,
      dueFrom: params.get("dueFrom") ?? undefined,
      dueTo: params.get("dueTo") ?? undefined,
      q: params.get("q") ?? undefined,
    }),
    [params]
  );

  const fetcher = useCallback(
    () => api.get<{ data: Task[] }>("/api/tasks", { params: filters }).then((r) => r.data.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.status, filters.priority, filters.dueFrom, filters.dueTo, filters.q]
  );

  const { data: tasks, loading, error, refetch } = useQuery(fetcher, [fetcher]);

  // Open the modal for a task referenced from a notification (?task=NN)
  useEffect(() => {
    if (!taskIdParam || !tasks) return;
    const target = tasks.find((t) => t.id === Number(taskIdParam));
    if (target) setEditingTask(target);
    const url = new URL(window.location.href);
    url.searchParams.delete("task");
    window.history.replaceState({}, "", url.toString());
  }, [taskIdParam, tasks]);

  const handleQuickStatus = async (task: Task, status: Task["status"]) => {
    try {
      await api.patch(`/api/tasks/${task.id}`, { status });
      void refetch();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const stats = useMemo(() => {
    const list = tasks ?? [];
    return {
      total: list.length,
      done: list.filter((t) => t.status === "DONE").length,
      overdue: list.filter((t) => t.isOverdue).length,
      inReview: list.filter((t) => t.status === "IN_REVIEW").length,
    };
  }, [tasks]);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Tasks</h1>
        {canManage && <Button onClick={() => setCreateOpen(true)}>New task</Button>}
      </div>

      {stats.total > 0 && (
        <div className="stat-grid stat-grid-sm">
          <StatCard label="Filtered results" value={stats.total} tone="violet" />
          <StatCard label="In review" value={stats.inReview} tone="amber" />
          <StatCard label="Done" value={stats.done} tone="green" />
          <StatCard label="Overdue" value={stats.overdue} tone="red" />
        </div>
      )}

      <TaskFilterBar />
      {error ? <ErrorBanner message={error} /> : null}
      <TaskForm
        open={createOpen || !!editingTask}
        onClose={() => { setCreateOpen(false); setEditingTask(null); }}
        initial={editingTask}
        statusOnly={!!editingTask && !canManage}
        onSaved={() => { setCreateOpen(false); setEditingTask(null); void refetch(); }}
      />

      <div className="panel">
        <div className="panel-head">
          <h3>{canManage ? "All tasks" : "My tasks"}</h3>
        </div>
        <TaskList tasks={tasks ?? []} loading={loading} onEdit={canManage ? setEditingTask : undefined} onQuickStatus={handleQuickStatus} highlightId={taskIdParam ? Number(taskIdParam) : null} />
      </div>
    </div>
  );
}
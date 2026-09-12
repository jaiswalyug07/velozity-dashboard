import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { useProjectRoom } from "../hooks/useProjectRoom";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { useRealtime } from "../context/RealtimeContext";
import { ProjectForm } from "../components/ProjectForm";
import { TaskForm } from "../components/TaskForm";
import { TaskList } from "../components/TaskList";
import { ActivityFeed } from "../components/ActivityFeed";
import { Button, ErrorBanner, PageLoader, StatCard } from "../components/ui";
import type { Project, Task } from "../types";
import { useAuth } from "../context/AuthContext";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { user } = useAuth();
  const { socket, connected } = useRealtime();
  const canManage = user?.role === "ADMIN" || user?.role === "PROJECT_MANAGER";
  const canUpdateStatus = user?.role === "DEVELOPER";
  const [editProject, setEditProject] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [liveTaskOverrides, setLiveTaskOverrides] = useState<Task[]>([]);

  useProjectRoom(projectId);
  const { events, loading: feedLoading } = useActivityFeed({ maxItems: 30 });

  const fetchProject = useCallback(() => api.get<{ data: Project }>(`/api/projects/${projectId}`).then((r) => r.data.data), [projectId]);
  const { data: project, loading: projLoading, error: projErr, refetch: refetchProject } = useQuery(fetchProject, [projectId]);

  const fetchTasks = useCallback(
    () => api.get<{ data: Task[] }>("/api/tasks", { params: { projectId } }).then((r) => r.data.data),
    [projectId]
  );
  const { data: tasks, loading: tasksLoading, refetch: refetchTasks, error: tasksErr } = useQuery(fetchTasks, [projectId]);

  // Merge real-time task updates (socket `task:updated`) into the loaded list so
  // everyone viewing this project sees status changes live, without refreshing.
  useEffect(() => {
    if (!socket) return;
    const onTask = (t: Task) => {
      if (t.projectId === projectId) {
        setLiveTaskOverrides((prev) => [...prev.filter((x) => x.id !== t.id), t]);
      }
    };
    socket.on("task:updated", onTask);
    return () => {
      socket.off("task:updated", onTask);
    };
  }, [socket, connected, projectId]);

  const shownTasks = useMemo(() => {
    if (!tasks) return [];
    if (liveTaskOverrides.length === 0) return tasks;
    const override = new Map(liveTaskOverrides.map((t) => [t.id, t]));
    return tasks.map((t) => override.get(t.id) ?? t);
  }, [tasks, liveTaskOverrides]);

  const taskStats = useMemo(() => {
    const list = shownTasks;
    return {
      total: list.length,
      todo: list.filter((t) => t.status === "TO_DO").length,
      inProgress: list.filter((t) => t.status === "IN_PROGRESS").length,
      review: list.filter((t) => t.status === "IN_REVIEW").length,
      done: list.filter((t) => t.status === "DONE").length,
      overdue: list.filter((t) => t.isOverdue).length,
    };
  }, [shownTasks]);

  if (projLoading || tasksLoading) return <PageLoader />;
  if (projErr) return <ErrorBanner message={projErr} />;
  if (tasksErr) return <ErrorBanner message={tasksErr} />;
  if (!project) return <ErrorBanner message="Project not found" />;

  const handleQuickStatus = async (task: Task, status: Task["status"]) => {
    try {
      await api.patch(`/api/tasks/${task.id}`, { status });
      void refetchTasks();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{project.name}</h1>
          {project.description && <p className="page-sub">{project.description}</p>}
          <div className="page-meta">
            {project.client && <span>Client: {project.client.name}</span>}
            {project.manager && <span>Manager: {project.manager.name}</span>}
          </div>
        </div>
        {canManage && (
          <>
            <Button onClick={() => setEditProject(true)}>Edit project</Button>
            <Button onClick={() => setTaskFormOpen(true)}>New task</Button>
          </>
        )}
      </div>

      <ProjectForm open={editProject} onClose={() => setEditProject(false)} project={project} onSaved={() => { setEditProject(false); void refetchProject(); }} />
      <TaskForm
        open={taskFormOpen || !!editingTask}
        onClose={() => { setTaskFormOpen(false); setEditingTask(null); }}
        projectId={projectId}
        initial={editingTask}
        statusOnly={!!editingTask && !!canUpdateStatus && !canManage}
        onSaved={() => { setTaskFormOpen(false); setEditingTask(null); void refetchTasks(); }}
      />

      <div className="stat-grid">
        <StatCard label="Total" value={taskStats.total} tone="violet" />
        <StatCard label="To Do" value={taskStats.todo} tone="gray" />
        <StatCard label="In Progress" value={taskStats.inProgress} tone="blue" />
        <StatCard label="In Review" value={taskStats.review} tone="amber" />
        <StatCard label="Done" value={taskStats.done} tone="green" />
        <StatCard label="Overdue" value={taskStats.overdue} tone="red" />
      </div>

      <div className="detail-panels">
        <div className="detail-left">
          <TaskList tasks={shownTasks} onEdit={canManage ? setEditingTask : undefined} onQuickStatus={canManage ? handleQuickStatus : canUpdateStatus ? handleQuickStatus : undefined} />
        </div>
        <div className="detail-right">
          <ActivityFeed events={events} loading={feedLoading} title="Project feed" />
        </div>
      </div>
    </div>
  );
}
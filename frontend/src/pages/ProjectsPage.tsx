import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { ProjectForm } from "../components/ProjectForm";
import { Button, EmptyState, ErrorBanner, PageLoader } from "../components/ui";
import type { Project } from "../types";
import { formatDate } from "../lib/format";

export default function ProjectsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const fetcher = useCallback(() => api.get<{ data: Project[] }>("/api/projects").then((r) => r.data.data), []);
  const { data: projects, loading, error, refetch } = useQuery(fetcher, []);

  const handleSaved = () => {
    setEditProject(null);
    setFormOpen(false);
    void refetch();
  };

  const handleDelete = async (p: Project) => {
    if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/projects/${p.id}`);
      void refetch();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Projects</h1>
        <Button onClick={() => { setEditProject(null); setFormOpen(true); }}>New project</Button>
      </div>

      <ProjectForm open={formOpen || !!editProject} onClose={() => { setFormOpen(false); setEditProject(null); }} project={editProject} onSaved={handleSaved} />

      {!projects?.length && <EmptyState title="No projects yet" detail="Create your first project to get started." />}
      <div className="card-grid">
        {projects?.map((p) => (
          <div className="project-card" key={p.id}>
            <div className="project-card-head">
              <Link to={`/projects/${p.id}`} className="project-link">
                <h3>{p.name}</h3>
              </Link>
              <div className="project-actions">
                <Button variant="ghost" className="btn-sm" onClick={() => { setEditProject(p); setFormOpen(true); }}>Edit</Button>
                <Button variant="ghost" className="btn-sm text-red" onClick={() => void handleDelete(p)}>Delete</Button>
              </div>
            </div>
            {p.description && <p className="project-desc">{p.description}</p>}
            <div className="project-meta">
              {p.client && <span>Client: {p.client.name}</span>}
              {p.manager && <span>Manager: {p.manager.name}</span>}
              <span>{p._count?.tasks ?? 0} tasks</span>
              <span>Created {formatDate(p.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
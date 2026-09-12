import { useCallback, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { useAuth } from "../context/AuthContext";
import { Button, EmptyState, ErrorBanner, Field, Input, Modal, PageLoader } from "../components/ui";
import type { Client } from "../types";

export default function ClientsPage() {
  const { user } = useAuth();
  const canCreate = user?.role === "ADMIN" || user?.role === "PROJECT_MANAGER";
  const canManage = user?.role === "ADMIN";
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetcher = useCallback(() => api.get<{ data: Client[] }>("/api/clients").then((r) => r.data.data), []);
  const { data: clients, loading, error, refetch } = useQuery(fetcher, []);

  const openForm = (c?: Client) => {
    setEditing(c ?? null);
    setName(c?.name ?? "");
    setCompany(c?.company ?? "");
    setContactEmail(c?.contactEmail ?? "");
    setSubmitError(null);
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const payload = { name: name.trim(), company: company.trim() || null, contactEmail: contactEmail.trim() || null };
      if (editing) await api.patch(`/api/clients/${editing.id}`, payload);
      else await api.post("/api/clients", payload);
      setFormOpen(false);
      void refetch();
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const del = async (c: Client) => {
    if (!confirm(`Delete client "${c.name}"? Projects referencing it may fail.`)) return;
    try {
      await api.delete(`/api/clients/${c.id}`);
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
        <h1 className="page-title">Clients</h1>
        {canCreate && <Button onClick={() => openForm()}>New client</Button>}
      </div>

      <Modal title={editing ? "Edit client" : "New client"} open={formOpen} onClose={() => setFormOpen(false)}>
        <form onSubmit={submit} className="form">
          {submitError && <ErrorBanner message={submitError} />}
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
          </Field>
          <Field label="Company">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Contact email">
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </Field>
          <div className="form-row">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      {!clients?.length && <EmptyState title="No clients yet" detail="Add clients to assign projects to them." />}
      <div className="card-grid">
        {clients?.map((c) => (
          <div className="project-card" key={c.id}>
            <div className="project-card-head">
              <h3>{c.name}</h3>
              {canManage && (
                <div className="project-actions">
                  <Button variant="ghost" className="btn-sm" onClick={() => openForm(c)}>Edit</Button>
                  <Button variant="ghost" className="btn-sm text-red" onClick={() => void del(c)}>Delete</Button>
                </div>
              )}
            </div>
            {c.company && <p className="project-desc">{c.company}</p>}
            <div className="project-meta">
              {c.contactEmail && <span>{c.contactEmail}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
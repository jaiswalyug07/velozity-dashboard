import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { Client, Project, User } from "../types";
import { Button, ErrorBanner, Field, Input, Modal, Select, Textarea } from "./ui";

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  onSaved: (project: Project) => void;
}

export function ProjectForm({ open, onClose, project, onSaved }: ProjectFormProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setClientId(project?.clientId ? String(project.clientId) : "");
    setManagerId(project?.managerId ? String(project.managerId) : "");
    api
      .get<{ data: Client[] }>("/api/clients")
      .then((res) => setClients(res.data.data))
      .catch(() => {});
    if (isAdmin) {
      api
        .get<{ data: User[] }>("/api/users", { params: { role: "PROJECT_MANAGER" } })
        .then((res) => setManagers(res.data.data))
        .catch(() => {});
    }
  }, [open, project, isAdmin]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientId) {
      setError("Name and client are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        clientId: Number(clientId),
        ...(isAdmin && managerId ? { managerId: Number(managerId) } : {}),
      };
      if (project) {
        const { data } = await api.patch<{ data: Project }>(`/api/projects/${project.id}`, payload);
        onSaved(data.data);
      } else {
        const { data } = await api.post<{ data: Project }>("/api/projects", payload);
        onSaved(data.data);
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={project ? "Edit project" : "New project"}
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {project ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="form">
        {error && <ErrorBanner message={error} />}
        <Field label="Project name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="e.g. Website Redesign" />
        </Field>
        <Field label="Client">
          <Select options={clients.map((c) => ({ value: String(c.id), label: c.name }))} value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Select a client" />
        </Field>
        {isAdmin && (
          <Field label="Project manager" hint={project && !isAdmin ? "" : "Defaults to you if not set."}>
            <Select options={managers.map((m) => ({ value: String(m.id), label: m.name }))} value={managerId} onChange={(e) => setManagerId(e.target.value)} placeholder="You (current user)" />
          </Field>
        )}
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Scope, goals, notes…" maxLength={2000} />
        </Field>
      </form>
    </Modal>
  );
}
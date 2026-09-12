import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { toDateInput } from "../lib/format";
import { PRIORITY_LABEL, STATUS_LABEL, TASK_PRIORITIES, TASK_STATUSES, type Task, type TaskPriority, type TaskStatus, type User } from "../types";
import { Button, ErrorBanner, Field, Input, Modal, Select, Textarea } from "./ui";

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  projectId?: number;
  initial?: Task | null;
  onSaved: (task: Task) => void;
  /** Hide fields non-managers shouldn't touch (e.g. developer status updates) */
  statusOnly?: boolean;
}

export function TaskForm({ open, onClose, projectId, initial, onSaved, statusOnly }: TaskFormProps) {
  const [developers, setDevelopers] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TO_DO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setAssignedToId(initial?.assignedToId ? String(initial.assignedToId) : "");
    setStatus(initial?.status ?? "TO_DO");
    setPriority(initial?.priority ?? "MEDIUM");
    setDueDate(toDateInput(initial?.dueDate));
    api
      .get<{ data: User[] }>("/api/users/developers")
      .then((res) => setDevelopers(res.data.data))
      .catch(() => {});
  }, [open, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!dueDate) {
      setError("Due date is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const due = new Date(`${dueDate}T23:59:59`).toISOString();
      if (initial) {
        const payload = statusOnly ? { status } : {
          title: title.trim(),
          description: description.trim() || null,
          assignedToId: assignedToId ? Number(assignedToId) : null,
          status,
          priority,
          dueDate: due,
        };
        const { data } = await api.patch<{ data: Task }>(`/api/tasks/${initial.id}`, payload);
        onSaved(data.data);
      } else {
        const { data } = await api.post<{ data: Task }>("/api/tasks", {
          title: title.trim(),
          description: description.trim() || null,
          projectId,
          assignedToId: assignedToId ? Number(assignedToId) : null,
          status,
          priority,
          dueDate: due,
        });
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
      title={initial ? (statusOnly ? "Update task status" : "Edit task") : "Create task"}
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!initial && !projectId}>
            {initial ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="form">
        {error && <ErrorBanner message={error} />}

        {!statusOnly ? (
          <>
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Implement login flow" maxLength={200} />
            </Field>
            <div className="form-row">
              <Field label="Status">
                <Select options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} />
              </Field>
              <Field label="Priority">
                <Select options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} />
              </Field>
            </div>
          </>
        ) : (
          <Field label="New status">
            <Select options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} />
          </Field>
        )}

        {!statusOnly && (
          <>
            <div className="form-row">
              <Field label="Assigned developer">
                <Select
                  options={developers.map((d) => ({ value: String(d.id), label: d.name }))}
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  placeholder="Unassigned"
                />
              </Field>
              <Field label="Due date">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What needs to be done?" maxLength={5000} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
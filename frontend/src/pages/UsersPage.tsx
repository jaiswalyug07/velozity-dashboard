import { useCallback, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { Button, ErrorBanner, Field, Input, Modal, PageLoader, Select } from "../components/ui";
import type { Role, User } from "../types";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "PROJECT_MANAGER", label: "Project Manager" },
  { value: "DEVELOPER", label: "Developer" },
];

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "PM",
  DEVELOPER: "Dev",
};

export default function UsersPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("DEVELOPER");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetcher = useCallback(() => api.get<{ data: User[] }>("/api/users").then((r) => r.data.data), []);
  const { data: users, loading, error, refetch } = useQuery(fetcher, []);

  const openForm = (u?: User) => {
    setEditing(u ?? null);
    setName(u?.name ?? "");
    setEmail(u?.email ?? "");
    setPassword("");
    setRole(u?.role ?? "DEVELOPER");
    setActive(u?.active ?? true);
    setSubmitError(null);
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    setSubmitError(null);
    try {
      if (editing) {
        await api.patch(`/api/users/${editing.id}`, {
          name: name.trim(),
          email: email.trim(),
          role,
          active,
          ...(password ? { password } : {}),
        });
      } else {
        await api.post("/api/users", { name: name.trim(), email: email.trim(), password, role });
      }
      setFormOpen(false);
      void refetch();
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const del = async (u: User) => {
    if (!confirm(`Delete user "${u.name}"?`)) return;
    try {
      await api.delete(`/api/users/${u.id}`);
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
        <h1 className="page-title">Users</h1>
        <Button onClick={() => openForm()}>Add user</Button>
      </div>

      <Modal title={editing ? "Edit user" : "Add user"} open={formOpen} onClose={() => setFormOpen(false)}>
        <form onSubmit={submit} className="form">
          {submitError && <ErrorBanner message={submitError} />}
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={editing ? "Password (leave blank to keep current)" : "Password"}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={editing ? 0 : 6} />
          </Field>
          <Field label="Role">
            <Select options={ROLE_OPTIONS} value={role} onChange={(e) => setRole(e.target.value as Role)} />
          </Field>
          {editing && (
            <label className="check-row">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active
            </label>
          )}
          <div className="form-row">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={!editing && password.length < 6}>
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      <div className="panel">
        <div className="panel-head"><h3>Team</h3></div>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td>
                  <span className={`role-chip role-${u.role.toLowerCase()}`}>{ROLE_LABEL[u.role]}</span>
                </td>
                <td>{u.active ? <span className="muted">Active</span> : <span className="text-red">Disabled</span>}</td>
                <td className="align-right">
                  <Button variant="ghost" className="btn-sm" onClick={() => openForm(u)}>Edit</Button>
                  <Button variant="ghost" className="btn-sm text-red" onClick={() => void del(u)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
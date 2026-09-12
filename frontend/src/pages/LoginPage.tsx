import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/api";
import { Button, ErrorBanner, Field, Input } from "../components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSaving(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-login">
          <span className="brand-mark">V</span>
          <span className="brand-name">Velozity Dashboard</span>
        </div>
        <p className="login-sub">Sign in to continue</p>
        <form onSubmit={submit} className="form">
          {error && <ErrorBanner message={error} />}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Button type="submit" loading={saving}>
            Sign in
          </Button>
        </form>
        <div className="login-footer">
          <details>
            <summary>Demo credentials</summary>
            <ul>
              <li><strong>Admin:</strong> admin@velozity.com / Admin@1234</li>
              <li><strong>PM:</strong> pm1@velozity.com / Pm@1234</li>
              <li><strong>Dev:</strong> dev1@velozity.com / Dev@1234</li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
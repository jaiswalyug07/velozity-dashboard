import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/* ---------------------------------- Button ---------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({ variant = "primary", loading, disabled, children, className, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}${className ? ` ${className}` : ""}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner spinner-sm" aria-hidden />}
      {children}
    </button>
  );
}

/* ----------------------------------- Badge ---------------------------------- */

type BadgeTone = "gray" | "blue" | "amber" | "green" | "red" | "violet";

export function Badge({ tone = "gray", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={`badge badge-${tone}${className ? ` ${className}` : ""}`}>{children}</span>;
}

/* ---------------------------------- Spinner --------------------------------- */

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <span className="spinner" aria-label={label} />
      <span className="spinner-label">{label}</span>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="center-fill">
      <Spinner />
    </div>
  );
}

/* ------------------------------------ Modal ---------------------------------- */

export function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${wide ? " modal-wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------- Fields ----------------------------------- */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input(props: InputProps) {
  return <input className="input" {...props} />;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ options, placeholder, className, ...rest }: SelectProps) {
  return (
    <select className={`input${className ? ` ${className}` : ""}`} {...rest}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea(props: TextareaProps) {
  return <textarea className="input textarea" {...props} />;
}

/* --------------------------------- Empty state -------------------------------- */

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◇</div>
      <h4>{title}</h4>
      {detail && <p>{detail}</p>}
    </div>
  );
}

/* ----------------------------------- Error ----------------------------------- */

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner">
      <strong>Error</strong> — {message}
    </div>
  );
}

/* ------------------------------- Stat card ---------------------------------- */

export function StatCard({ label, value, tone = "primary", sub }: { label: string; value: ReactNode; tone?: BadgeTone | "primary"; sub?: ReactNode }) {
  return (
    <div className="stat-card">
      <div className={`stat-dot stat-${tone}`} />
      <div className="stat-body">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  );
}
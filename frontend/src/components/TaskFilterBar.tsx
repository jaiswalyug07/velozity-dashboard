import { useNavigate, useSearchParams } from "react-router-dom";
import { TASK_PRIORITIES, TASK_STATUSES, PRIORITY_LABEL, STATUS_LABEL } from "../types";
import { Input, Select } from "./ui";

/**
 * Filter bar that pushes every change into URL query parameters so filters are
 * shareable as links (requirement #4). The page reads them back from the URL.
 */
export function TaskFilterBar({ projectId }: { projectId?: number }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Keep `task`/`project` filter coherent
    setParams(next, { replace: true });
    if (projectId && key === "project") navigate(next.size ? `/tasks?${next.toString()}` : `/tasks`);
  };

  return (
    <div className="filter-bar">
      <Select
        options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        value={params.get("status") ?? ""}
        onChange={(e) => set("status", e.target.value)}
        placeholder="Any status"
      />
      <Select
        options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
        value={params.get("priority") ?? ""}
        onChange={(e) => set("priority", e.target.value)}
        placeholder="Any priority"
      />
      <Input type="date" value={params.get("dueFrom") ?? ""} onChange={(e) => set("dueFrom", e.target.value)} aria-label="Due from" title="Due from" />
      <Input type="date" value={params.get("dueTo") ?? ""} onChange={(e) => set("dueTo", e.target.value)} aria-label="Due to" title="Due to" />
      <Input
        value={params.get("q") ?? ""}
        onChange={(e) => set("q", e.target.value)}
        placeholder="Search title…"
        className="filter-search"
        aria-label="Search tasks"
      />
      {params.size > 0 && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => (projectId ? navigate(`/tasks`) : setParams(new URLSearchParams(), { replace: true }))}
        >
          Reset
        </button>
      )}
    </div>
  );
}
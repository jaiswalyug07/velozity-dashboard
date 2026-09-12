import { Badge } from "./ui";
import { PRIORITY_LABEL, STATUS_LABEL, type TaskPriority, type TaskStatus } from "../types";

const STATUS_TONE: Record<TaskStatus, string> = {
  TO_DO: "gray",
  IN_PROGRESS: "blue",
  IN_REVIEW: "amber",
  DONE: "green",
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  LOW: "gray",
  MEDIUM: "blue",
  HIGH: "amber",
  CRITICAL: "red",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge tone={STATUS_TONE[status] as "gray" | "blue" | "amber" | "green"}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge tone={PRIORITY_TONE[priority] as "gray" | "blue" | "amber" | "red"}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function OverdueBadge() {
  return <Badge tone="red">Overdue</Badge>;
}
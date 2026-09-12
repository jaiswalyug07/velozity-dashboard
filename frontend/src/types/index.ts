export type Role = "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER";

export type TaskStatus = "TO_DO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ActivityType =
  | "PROJECT_CREATED"
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "TASK_OVERDUE";

export type NotificationType = "TASK_ASSIGNED" | "TASK_IN_REVIEW" | "TASK_OVERDUE";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  active?: boolean;
  createdAt?: string;
}

export interface Client {
  id: number;
  name: string;
  company: string | null;
  contactEmail: string | null;
  createdAt?: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  clientId: number;
  managerId: number;
  createdAt: string;
  updatedAt: string;
  client?: Pick<Client, "id" | "name" | "company">;
  manager?: Pick<User, "id" | "name" | "email">;
  _count?: { tasks: number };
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  projectId: number;
  assignedToId: number | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: number;
    name: string;
    managerId: number;
    manager?: { id: number; name: string };
  };
  assignedTo?: Pick<User, "id" | "name"> | null;
}

export interface ActivityEvent {
  id: number;
  actorId: number;
  projectId: number;
  taskId: number | null;
  type: ActivityType;
  message: string;
  createdAt: string;
  actor?: { id: number; name: string };
  actorName?: string;
  task?: { id: number; title: string } | null;
  project?: { id: number; name: string };
}

export interface Notification {
  id: number;
  userId: number;
  actorId: number | null;
  projectId: number | null;
  taskId: number | null;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
  actor?: { id: number; name: string } | null;
}

export interface ApiEnvelope<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}

export interface AdminDashboard {
  totalProjects: number;
  totalTasks: number;
  overdueCount: number;
  tasksByStatus: { status: TaskStatus; _count: { _all: number } }[];
  tasksByPriority: { priority: TaskPriority; _count: { _all: number } }[];
  onlineCount: number;
  recentActivity: ActivityEvent[];
  clients: number;
  developers: number;
}

export interface PmDashboard {
  projects: (Project & { _count?: { tasks: number } })[];
  tasksByPriority: { priority: TaskPriority; _count: { _all: number } }[];
  dueThisWeek: Task[];
  totalTasks: number;
  overdueCount: number;
  recentActivity: ActivityEvent[];
}

export interface DevDashboard {
  tasks: Task[];
  unread: number;
  doneCount: number;
  overdueCount: number;
  inProgressCount: number;
}

export interface PresencePayload {
  count: number;
  users: { id: number }[];
}

export const TASK_STATUSES: TaskStatus[] = ["TO_DO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
export const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};
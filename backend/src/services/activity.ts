import { prisma } from "../lib/prisma.js";
import { emitActivity, emitNotification, emitTaskUpdate } from "../lib/socket.js";
import type { ActivityType, NotificationType, Task } from "@prisma/client";

const STATUS_LABEL: Record<string, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}

export async function createActivity(
  input: {
    actorId: number;
    projectId: number;
    taskId?: number;
    type: ActivityType;
    message: string;
  },
  assigneeId?: number | null
) {
  const event = await prisma.activityEvent.create({
    data: input,
    include: { actor: { select: { name: true } } },
  });
  emitActivity(event, assigneeId);
  return event;
}

export async function createNotification(
  input: {
    userId: number;
    actorId?: number;
    projectId?: number;
    taskId?: number;
    type: NotificationType;
    message: string;
  }
) {
  const notification = await prisma.notification.create({ data: input });
  await emitNotification(notification);
  return notification;
}

/** Run inside a transaction-friendly pattern: creates activity + notification + emits task update */
export async function logStatusChange(params: {
  task: Task & { projectId: number };
  actorId: number;
  managerId: number;
  oldStatus: string;
  newStatus: string;
  actorName: string;
}) {
  const { task, actorId, managerId, oldStatus, newStatus, actorName } = params;
  const message = `${actorName} moved Task #${task.id} from ${statusLabel(oldStatus)} → ${statusLabel(newStatus)}`;

  const event = await createActivity(
    {
      actorId,
      projectId: task.projectId,
      taskId: task.id,
      type: "TASK_STATUS_CHANGED",
      message,
    },
    task.assignedToId
  );

  // Notify the PM when a task they own moves to In Review
  if (newStatus === "IN_REVIEW") {
    await createNotification({
      userId: managerId,
      actorId,
      projectId: task.projectId,
      taskId: task.id,
      type: "TASK_IN_REVIEW",
      message: `${actorName} moved Task #${task.id} (${task.title}) to In Review`,
    });
  }

  emitTaskUpdate(task);
  return event;
}
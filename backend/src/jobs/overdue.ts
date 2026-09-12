import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { createActivity, createNotification } from "../services/activity.js";

/**
 * Scheduled background job (node-cron) that flags tasks past their due date
 * as Overdue. Runs every 5 minutes; the flag is persisted in the DB and the
 * activity feed is updated — this does NOT happen on page load.
 */
export function startOverdueJob() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      await flagOverdueTasks();
    } catch (err) {
      console.error("[overdue-job] failed:", err);
    }
  });
  console.log("[overdue-job] scheduled every 5 min");
}

export async function flagOverdueTasks() {
  const now = new Date();
  const overdueTasks = await prisma.task.findMany({
    where: { dueDate: { lt: now }, isOverdue: false, status: { not: "DONE" } },
    include: {
      project: { select: { id: true, managerId: true, manager: { select: { name: true } } } },
    },
  });

  for (const task of overdueTasks) {
    await prisma.task.update({ where: { id: task.id }, data: { isOverdue: true } });

    const [activity, notification] = await Promise.all([
      createActivity({
        actorId: task.project.managerId,
        projectId: task.projectId,
        taskId: task.id,
        type: "TASK_OVERDUE",
        message: `Task #${task.id} (${task.title}) is overdue`,
      }, task.assignedToId),
      task.assignedToId
        ? createNotification({
            userId: task.assignedToId,
            actorId: task.project.managerId,
            projectId: task.projectId,
            taskId: task.id,
            type: "TASK_OVERDUE",
            message: `Task #${task.id} (${task.title}) is overdue`,
          })
        : Promise.resolve(null),
    ]);

    void activity;
    void notification;
  }

  return overdueTasks.length;
}
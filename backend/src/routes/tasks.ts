import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { authenticate, canAccessProject } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { createActivity, createNotification, logStatusChange } from "../services/activity.js";
import { emitTaskUpdate } from "../lib/socket.js";

const router = Router();
router.use(authenticate);

const STATUSES = ["TO_DO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  projectId: z.number().int().positive(),
  assignedToId: z.number().int().positive().optional().nullable(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  dueDate: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    assignedToId: z.number().int().positive().nullable().optional(),
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    dueDate: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field required" });

const taskInclude = {
  project: { select: { id: true, name: true, managerId: true, manager: { select: { id: true, name: true } } } },
  assignedTo: { select: { id: true, name: true } },
} as const;

function parseDue(v: string): Date {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, "BAD_REQUEST", "Invalid dueDate");
  return d;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { projectId, status, priority, dueFrom, dueTo, assignee, q, s } = req.query as Record<string, string | undefined>;

    let projectScope: { projectId: number } | undefined;
    if (projectId) {
      const pid = Number(projectId);
      if (!Number.isInteger(pid)) throw new ApiError(400, "BAD_REQUEST", "Invalid projectId");
      if (!(await canAccessProject(req, pid))) {
        throw new ApiError(403, "FORBIDDEN", "You do not have access to this project");
      }
      projectScope = { projectId: pid };
    }

    const search = q ?? s;
    const where = buildRoleScopedWhere(req.user!, {
      ...(projectScope ?? {}),
      ...(status ? { status: status as never } : {}),
      ...(priority ? { priority: priority as never } : {}),
      ...(dueFrom || dueTo
        ? {
            dueDate: {
              ...(dueFrom ? { gte: parseDue(dueFrom) } : {}),
              ...(dueTo ? { lte: parseDue(dueTo) } : {}),
            },
          }
        : {}),
      ...(assignee ? { assignedToId: Number(assignee) } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    });

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { id: "asc" }],
    });
    res.json({ data: tasks });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const task = await prisma.task.findUnique({ where: { id }, include: taskInclude });
    if (!task) throw new ApiError(404, "NOT_FOUND", "Task not found");
    if (!(await canAccessTask(req.user!, task))) {
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this task");
    }
    res.json({ data: task });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    // Only admin or PM who manages the project can create tasks
    if (req.user!.role === "DEVELOPER") {
      throw new ApiError(403, "FORBIDDEN", "Developers cannot create tasks");
    }
    const body = createTaskSchema.parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: body.projectId },
      include: { manager: { select: { id: true, name: true } } },
    });
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
    if (req.user!.role === "PROJECT_MANAGER" && project.managerId !== req.user!.id) {
      throw new ApiError(403, "FORBIDDEN", "You can only create tasks in projects you manage");
    }

    if (body.assignedToId != null) {
      const assignee = await prisma.user.findFirst({ where: { id: body.assignedToId, role: "DEVELOPER" } });
      if (!assignee) throw new ApiError(400, "BAD_REQUEST", "Assignee must be a developer");
    }

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        projectId: body.projectId,
        assignedToId: body.assignedToId ?? null,
        status: body.status ?? "TO_DO",
        priority: body.priority,
        dueDate: parseDue(body.dueDate),
      },
      include: taskInclude,
    });

    await createActivity({
      actorId: req.user!.id,
      projectId: body.projectId,
      taskId: task.id,
      type: "TASK_CREATED",
      message: `${req.user!.name} created Task #${task.id}: ${task.title}`,
    }, task.assignedToId);

    if (task.assignedToId) {
      await createNotification({
        userId: task.assignedToId,
        actorId: req.user!.id,
        projectId: body.projectId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        message: `${req.user!.name} assigned Task #${task.id} (${task.title}) to you`,
      });
      await createActivity({
        actorId: req.user!.id,
        projectId: body.projectId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        message: `${req.user!.name} assigned Task #${task.id} to ${project.manager.name}`,
      }, task.assignedToId);
    }

    emitTaskUpdate(task);
    res.status(201).json({ data: task });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = updateTaskSchema.parse(req.body);

    const existing = await prisma.task.findUnique({
      where: { id },
      include: { project: { select: { id: true, managerId: true, manager: { select: { name: true } } } } },
    });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Task not found");

    const user = req.user!;
    const isAdmin = user.role === "ADMIN";
    const isManager = user.role === "PROJECT_MANAGER" && existing.project.managerId === user.id;
    const isAssignee = user.role === "DEVELOPER" && existing.assignedToId === user.id;

    if (!isAdmin && !isManager && !isAssignee) {
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this task");
    }

    // Developers may only change status of their own tasks
    if (user.role === "DEVELOPER") {
      const allowedKeys = Object.keys(body);
      if (allowedKeys.length !== 1 || allowedKeys[0] !== "status") {
        throw new ApiError(403, "FORBIDDEN", "Developers can only update task status");
      }
    }

    // Reject reassignment to a non-developer
    if (body.assignedToId != null && body.assignedToId !== existing.assignedToId) {
      const assignee = await prisma.user.findFirst({ where: { id: body.assignedToId, role: "DEVELOPER" } });
      if (!assignee) throw new ApiError(400, "BAD_REQUEST", "Assignee must be a developer");
    }

    const wasCompleted = existing.status === "DONE";
    const toCompleted = body.status === "DONE";
    // Overdue flag cleared when a task moves to DONE
    const nextOverdue = toCompleted ? false : existing.isOverdue;

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.dueDate !== undefined ? { dueDate: parseDue(body.dueDate) } : {}),
        ...(body.status !== undefined ? { isOverdue: nextOverdue } : {}),
      },
      include: taskInclude,
    });

    // Emit activity for status changes
    if (body.status !== undefined && body.status !== existing.status) {
      const statusEvent = await logStatusChange({
        task,
        actorId: user.id,
        managerId: existing.project.managerId,
        oldStatus: existing.status,
        newStatus: body.status,
        actorName: user.name,
      });
      // If the task moved to DONE, log that it was completed
      if (body.status === "DONE" && !wasCompleted) {
        await createActivity({
          actorId: user.id,
          projectId: task.projectId,
          taskId: task.id,
          type: "TASK_ASSIGNED",
          message: `${user.name} completed Task #${task.id}: ${task.title}`,
        }, task.assignedToId);
      }
      void statusEvent;
    }

    // Reassignment notification
    if (body.assignedToId !== undefined && body.assignedToId !== existing.assignedToId && body.assignedToId != null) {
      await createNotification({
        userId: body.assignedToId,
        actorId: user.id,
        projectId: task.projectId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        message: `${user.name} assigned Task #${task.id} (${task.title}) to you`,
      });
      await createActivity({
        actorId: user.id,
        projectId: task.projectId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        message: `${user.name} reassigned Task #${task.id} to the new developer`,
      }, body.assignedToId);
    }

    // Due date / title edits logged so the task's activity log stays complete
    const userCanEdit = isAdmin || isManager;
    if (userCanEdit && (body.title !== undefined || body.priority !== undefined || body.dueDate !== undefined)) {
      await createActivity({
        actorId: user.id,
        projectId: task.projectId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        message: `${user.name} updated Task #${task.id}: ${task.title}`,
      }, task.assignedToId);
    }

    emitTaskUpdate(task);
    res.json({ data: task });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.task.findUnique({ where: { id }, include: { project: { select: { managerId: true } } } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Task not found");

    const isAdmin = req.user!.role === "ADMIN";
    const isManager = req.user!.role === "PROJECT_MANAGER" && existing.project.managerId === req.user!.id;
    if (!isAdmin && !isManager) {
      throw new ApiError(403, "FORBIDDEN", "Only admins or the managing PM can delete tasks");
    }

    await prisma.notification.deleteMany({ where: { taskId: id } });
    await prisma.task.delete({ where: { id } });
    res.json({ data: { ok: true } });
  })
);

function buildRoleScopedWhere(
  user: { id: number; role: string },
  filters: Record<string, unknown>
) {
  if (user.role === "ADMIN") return filters;
  if (user.role === "PROJECT_MANAGER") {
    return { ...filters, project: { managerId: user.id } };
  }
  return { ...filters, assignedToId: user.id };
}

async function canAccessTask(
  user: { id: number; role: string },
  task: { id: number; projectId: number; assignedToId: number | null; project: { managerId: number } }
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role === "PROJECT_MANAGER") return task.project.managerId === user.id;
  return task.assignedToId === user.id;
}

export default router;
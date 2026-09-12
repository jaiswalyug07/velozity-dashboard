import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { getOnlineCount } from "../lib/socket.js";

const router = Router();
router.use(authenticate);

router.get(
  "/admin",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") return res.status(403).json({ error: { code: "FORBIDDEN", message: "Admins only", details: [] } });

    const [totalProjects, totalTasks, overdueCount, tasksByStatus, tasksByPriority, onlineCount, recentActivity] =
      await Promise.all([
        prisma.project.count(),
        prisma.task.count(),
        prisma.task.count({ where: { status: { not: "DONE" }, dueDate: { lt: new Date() } } }),
        prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.task.groupBy({ by: ["priority"], _count: { _all: true } }),
        Promise.resolve(getOnlineCount()),
        prisma.activityEvent.findMany({
          include: { actor: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
          orderBy: { id: "desc" },
          take: 8,
        }),
      ]);

    res.json({
      data: {
        totalProjects,
        totalTasks,
        overdueCount,
        tasksByStatus,
        tasksByPriority,
        onlineCount,
        recentActivity,
        clients: await prisma.client.count(),
        developers: await prisma.user.count({ where: { role: "DEVELOPER" } }),
      },
    });
  })
);

router.get(
  "/pm",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "PROJECT_MANAGER") return res.status(403).json({ error: { code: "FORBIDDEN", message: "PMs only", details: [] } });

    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [projects, tasksByPriority, dueThisWeek, totalTasks, overdueCount, recentActivity] = await Promise.all([
      prisma.project.findMany({
        where: { managerId: req.user!.id },
        include: { client: { select: { name: true } }, _count: { select: { tasks: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.task.groupBy({
        by: ["priority"],
        where: { project: { managerId: req.user!.id } },
        _count: { _all: true },
      }),
      prisma.task.findMany({
        where: { project: { managerId: req.user!.id }, dueDate: { gte: now, lte: weekEnd }, status: { not: "DONE" } },
        include: { project: { select: { name: true } }, assignedTo: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.task.count({ where: { project: { managerId: req.user!.id } } }),
      prisma.task.count({
        where: { project: { managerId: req.user!.id }, status: { not: "DONE" }, dueDate: { lt: now } },
      }),
      prisma.activityEvent.findMany({
        where: { project: { managerId: req.user!.id } },
        include: { actor: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
        orderBy: { id: "desc" },
        take: 8,
      }),
    ]);

    res.json({ data: { projects, tasksByPriority, dueThisWeek, totalTasks, overdueCount, recentActivity } });
  })
);

router.get(
  "/dev",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "DEVELOPER") return res.status(403).json({ error: { code: "FORBIDDEN", message: "Developers only", details: [] } });

    const tasks = await prisma.task.findMany({
      where: { assignedToId: req.user!.id },
      include: { project: { select: { id: true, name: true } } },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { id: "asc" }],
    });

    const unread = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } });

    res.json({
      data: {
        tasks,
        unread,
        doneCount: tasks.filter((t) => t.status === "DONE").length,
        overdueCount: tasks.filter((t) => t.isOverdue).length,
        inProgressCount: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      },
    });
  })
);

export default router;
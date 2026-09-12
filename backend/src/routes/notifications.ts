import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { emitUnreadCount } from "../lib/socket.js";

const router = Router();
router.use(authenticate);

const notificationSelect = {
  id: true,
  type: true,
  message: true,
  isRead: true,
  createdAt: true,
  taskId: true,
  projectId: true,
  actor: { select: { id: true, name: true } },
} as const;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unreadOnly === "true";
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id, ...(unreadOnly ? { isRead: false } : {}) },
      select: notificationSelect,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ data: notifications });
  })
);

router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    });
    res.json({ data: { count } });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.notification.findFirst({ where: { id, userId: req.user!.id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Notification not found");
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    await emitUnreadCount(req.user!.id);
    res.json({ data: { ok: true } });
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    await emitUnreadCount(req.user!.id);
    res.json({ data: { ok: true } });
  })
);

export default router;
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

/**
 * Role-scoped activity feed.
 * - Admin: all events
 * - PM: events for projects they manage
 * - Dev: events for tasks assigned to them
 * Supports `after` (event id) for missed-event catchup so users see the
 * last (up to 20) events they missed while offline.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const after = req.query.after ? Number(req.query.after) : null;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const role = req.user!.role;

    let where: Record<string, unknown> = {};
    if (role === "PROJECT_MANAGER") {
      where = { project: { managerId: req.user!.id } };
    } else if (role === "DEVELOPER") {
      where = { task: { assignedToId: req.user!.id } };
    }

    if (after) {
      const afterId = Number(after);
      if (Number.isInteger(afterId)) {
        where = { ...where, id: { gt: afterId } };
      }
    }

    const events = await prisma.activityEvent.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { id: "desc" },
      take: limit,
    });

    // Return chronological so the client can concatenate with *before-content*
    events.reverse();
    res.json({ data: events });
  })
);

export default router;
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { canAccessProject } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

const createClientSchema = z.object({
  name: z.string().min(1).max(160),
  company: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
});

const updateClientSchema = createClientSchema.partial().refine((o) => Object.keys(o).length > 0, {
  message: "At least one field required",
});

// Clients list: admins see all; PMs see all clients so they can assign
// projects to them. Developers get an empty list (they don't manage clients).
router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.user!.role === "DEVELOPER") {
      return res.json({ data: [] });
    }
    const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
    return res.json({ data: clients });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "PROJECT_MANAGER"),
  asyncHandler(async (req, res) => {
    const body = createClientSchema.parse(req.body);
    const client = await prisma.client.create({
      data: {
        name: body.name,
        company: body.company ?? null,
        contactEmail: body.contactEmail ?? null,
      },
    });
    res.status(201).json({ data: client });
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = updateClientSchema.parse(req.body);
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Client not found");
    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.company !== undefined ? { company: body.company } : {}),
        ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
      },
    });
    res.json({ data: client });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Client not found");
    await prisma.client.delete({ where: { id } });
    res.json({ data: { ok: true } });
  })
);

export default router;
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { authenticate, requireRole, canAccessProject } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { createActivity } from "../services/activity.js";

const router = Router();
router.use(authenticate);

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  clientId: z.number().int().positive(),
  managerId: z.number().int().positive().optional(),
});

const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    clientId: z.number().int().positive().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field required" });

const projectInclude = {
  client: { select: { id: true, name: true, company: true } },
  manager: { select: { id: true, name: true, email: true } },
  _count: { select: { tasks: true } },
} as const;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    let where = {};
    if (role === "PROJECT_MANAGER") where = { managerId: req.user!.id };
    if (role === "DEVELOPER") {
      where = { tasks: { some: { assignedToId: req.user!.id } } };
    }
    const projects = await prisma.project.findMany({ where, include: projectInclude, orderBy: { createdAt: "desc" } });
    res.json({ data: projects });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id }, include: projectInclude });
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
    if (!(await canAccessProject(req, id))) {
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this project");
    }
    res.json({ data: project });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "PROJECT_MANAGER"),
  asyncHandler(async (req, res) => {
    const body = createProjectSchema.parse(req.body);
    const client = await prisma.client.findUnique({ where: { id: body.clientId } });
    if (!client) throw new ApiError(400, "BAD_REQUEST", "Client does not exist");

    let managerId = body.managerId ?? req.user!.id;
    if (req.user!.role === "PROJECT_MANAGER") {
      // PM can only create projects for themselves
      if (body.managerId && body.managerId !== req.user!.id) {
        throw new ApiError(403, "FORBIDDEN", "Project managers can only create their own projects");
      }
      managerId = req.user!.id;
    } else if (managerId) {
      const manager = await prisma.user.findFirst({ where: { id: managerId, role: "PROJECT_MANAGER" } });
      if (!manager) throw new ApiError(400, "BAD_REQUEST", "Manager must be a project manager");
    }

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        clientId: body.clientId,
        managerId,
      },
      include: projectInclude,
    });

    await createActivity({
      actorId: req.user!.id,
      projectId: project.id,
      type: "PROJECT_CREATED",
      message: `${req.user!.name} created project "${project.name}"`,
    });

    res.status(201).json({ data: project });
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN", "PROJECT_MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = updateProjectSchema.parse(req.body);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
    if (req.user!.role === "PROJECT_MANAGER" && project.managerId !== req.user!.id) {
      throw new ApiError(403, "FORBIDDEN", "You can only edit projects you manage");
    }

    if (body.clientId !== undefined) {
      const client = await prisma.client.findUnique({ where: { id: body.clientId } });
      if (!client) throw new ApiError(400, "BAD_REQUEST", "Client does not exist");
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      },
      include: projectInclude,
    });

    const event = await createActivity({
      actorId: req.user!.id,
      projectId: id,
      type: "PROJECT_CREATED",
      message: `${req.user!.name} updated project "${updated.name}"`,
    });
    void event;

    res.json({ data: updated });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN", "PROJECT_MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
    if (req.user!.role === "PROJECT_MANAGER" && project.managerId !== req.user!.id) {
      throw new ApiError(403, "FORBIDDEN", "You can only delete projects you manage");
    }
    await prisma.task.deleteMany({ where: { projectId: id } });
    await prisma.project.delete({ where: { id } });
    res.json({ data: { ok: true } });
  })
);

export default router;
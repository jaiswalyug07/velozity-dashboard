import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";

const router = Router();
router.use(authenticate);

const developerSelect = { id: true, email: true, name: true, role: true, active: true } as const;

/** Any authenticated user may list developers (needed to assign tasks). */
router.get(
  "/developers",
  asyncHandler(async (_req, res) => {
    const devs = await prisma.user.findMany({
      where: { role: "DEVELOPER", active: true },
      select: developerSelect,
      orderBy: { name: "asc" },
    });
    res.json({ data: devs });
  })
);

router.use(requireRole("ADMIN"));

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(6).max(200),
  role: z.enum(["ADMIN", "PROJECT_MANAGER", "DEVELOPER"]),
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).max(200).optional(),
    role: z.enum(["ADMIN", "PROJECT_MANAGER", "DEVELOPER"]).optional(),
    active: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field required" });

const userSelect = { id: true, email: true, name: true, role: true, createdAt: true, active: true } as const;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const role = req.query.role as string | undefined;
    const users = await prisma.user.findMany({
      where: role ? { role: role as never } : {},
      select: userSelect,
      orderBy: { id: "asc" },
    });
    res.json({ data: users });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (exists) throw new ApiError(409, "CONFLICT", "A user with this email already exists");

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: body.role,
        active: true,
      },
      select: userSelect,
    });
    res.status(201).json({ data: user });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = updateUserSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");

    if (body.email && body.email.toLowerCase() !== user.email) {
      const clash = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (clash) throw new ApiError(409, "CONFLICT", "Email already in use");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email.toLowerCase() } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.password !== undefined ? { passwordHash: await bcrypt.hash(body.password, 10) } : {}),
      },
      select: userSelect,
    });
    res.json({ data: updated });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
    if (user.id === req.user!.id) throw new ApiError(400, "BAD_REQUEST", "You cannot delete your own account");
    await prisma.user.delete({ where: { id } });
    res.json({ data: { ok: true } });
  })
);

export default router;
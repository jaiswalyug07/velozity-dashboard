import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, loadUserById } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import type { Role } from "@prisma/client";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Missing access token", details: [] },
    });
  }
  const token = header.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired access token", details: [] },
    });
  }
  const user = await loadUserById(Number(payload.sub));
  if (!user) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "User no longer exists", details: [] },
    });
  }
  if (!user.active) {
    return res.status(403).json({
      error: { code: "ACCOUNT_DISABLED", message: "This account has been disabled", details: [] },
    });
  }
  req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Not authenticated", details: [] },
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not have permission for this action", details: [] },
      });
    }
    next();
  };
}

/** Ensures the request refers to a project the user may access; attaches project to res.locals */
export async function canAccessProject(req: Request, projectId: number): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === "ADMIN") return true;
  if (req.user.role === "PROJECT_MANAGER") {
    const p = await prisma.project.findFirst({ where: { id: projectId, managerId: req.user.id } });
    return !!p;
  }
  const t = await prisma.task.findFirst({ where: { projectId, assignedToId: req.user.id } });
  return !!t;
}
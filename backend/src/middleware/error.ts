import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, code: string, message: string, details: unknown = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.originalUrl}`, details: [] },
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }
  // Prisma known errors
  if (typeof err === "object" && err !== null && "code" in err && "message" in err) {
    const prisma = err as { code: string; message: string; meta?: { target?: string[] } };
    if (prisma.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: prisma.message,
          details: prisma.meta?.target ?? [],
        },
      });
    }
    if (prisma.code === "P2003") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "This record is still referenced by other records and cannot be deleted",
          details: prisma.meta?.target ?? [],
        },
      });
    }
  }
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong", details: [] },
  });
}
import { Router } from "express";
import type { Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken, loadUserById } from "../lib/jwt.js";
import { config } from "../config.js";
import { ApiError } from "../middleware/error.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});

function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }
    if (!user.active) {
      throw new ApiError(403, "ACCOUNT_DISABLED", "This account has been disabled");
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    res.json({
      data: { accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken: string | undefined = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new ApiError(401, "UNAUTHORIZED", "No refresh token");
    }
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired refresh token");
    }
    const user = await loadUserById(Number(payload.sub));
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "User no longer exists");
    }
    if (!user.active) {
      throw new ApiError(403, "ACCOUNT_DISABLED", "This account has been disabled");
    }

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user.id);
    setRefreshCookie(res, newRefreshToken);

    res.json({ data: { accessToken: newAccessToken } });
  })
);

router.post("/logout", (_req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/api/auth",
  });
  res.json({ data: { ok: true } });
});

router.get("/me", authenticate, (req, res) => {
  res.json({ data: req.user });
});

export default router;
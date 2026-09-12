import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "./prisma.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  sub: string;
}

function expiresIn(value: string): SignOptions["expiresIn"] {
  return value as SignOptions["expiresIn"];
}

export function signAccessToken(user: { id: number; email: string; role: string }): string {
  const payload: AccessTokenPayload = {
    sub: String(user.id),
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, config.accessTokenSecret, {
    expiresIn: expiresIn(config.accessTokenExpires),
  });
}

export function signRefreshToken(userId: number): string {
  return jwt.sign({ sub: String(userId) } satisfies RefreshTokenPayload, config.refreshTokenSecret, {
    expiresIn: expiresIn(config.refreshTokenExpires),
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, config.accessTokenSecret) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, config.refreshTokenSecret) as RefreshTokenPayload;
  } catch {
    return null;
  }
}

export async function loadUserById(userId: number) {
  return prisma.user.findUnique({ where: { id: userId } });
}
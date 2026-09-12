import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || "change-me-access-secret",
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || "change-me-refresh-secret",
  accessTokenExpires: process.env.ACCESS_TOKEN_EXPIRES || "15m",
  refreshTokenExpires: process.env.REFRESH_TOKEN_EXPIRES || "7d",
  // Individually controllable so the Docker demo can run over plain HTTP
  // while production (HTTPS on Vercel) defaults to secure cookies.
  cookieSecure: process.env.COOKIE_SECURE !== undefined ? process.env.COOKIE_SECURE === "true" : (process.env.NODE_ENV || "development") === "production",
  isProd: (process.env.NODE_ENV || "development") === "production",
} as const;
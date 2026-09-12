import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { config } from "./config.js";
import { initSocket } from "./lib/socket.js";
import { startOverdueJob } from "./jobs/overdue.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import clientRoutes from "./routes/clients.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import notificationRoutes from "./routes/notifications.js";
import activityRoutes from "./routes/activity.js";
import dashboardRoutes from "./routes/dashboard.js";

const app = express();
app.disable("x-powered-by");

app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ data: { status: "ok" } });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);

startOverdueJob();

server.listen(config.port, () => {
  console.log(`[server] API listening on http://localhost:${config.port}`);
});
import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/jwt.js";
import type { ActivityEvent, Notification, Task } from "@prisma/client";
import { config } from "../config.js";

let io: Server | null = null;

const ROOMS = {
  admin: "admin",
  user: (id: number) => `user:${id}`,
  project: (id: number) => `project:${id}`,
} as const;

/** userId -> set of socket ids (presence tracking) */
const onlineUsers = new Map<number, Set<string>>();

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("unauthorized"));
      const payload = verifyAccessToken(token);
      if (!payload) return next(new Error("unauthorized: invalid token"));
      const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
      if (!user || !user.active) return next(new Error("unauthorized: inactive or missing user"));
      socket.data.user = user;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as { id: number; name: string; role: string; email: string };

    // Join personal room (notifications, dev-only feed)
    socket.join(ROOMS.user(user.id));

    // Role-based feed rooms
    if (user.role === "ADMIN") {
      socket.join(ROOMS.admin);
    } else if (user.role === "PROJECT_MANAGER") {
      const managed = await prisma.project.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      managed.forEach((p) => socket.join(ROOMS.project(p.id)));
    }

    // Presence
    const set = onlineUsers.get(user.id) ?? new Set<string>();
    set.add(socket.id);
    onlineUsers.set(user.id, set);
    emitPresence();
    socket.to(ROOMS.admin).emit("user:connected", { id: user.id, name: user.name, role: user.role });

    // Dev can subscribe to a project they're viewing for live updates (join/leave rooms)
    socket.on("room:join", async (data: { projectId: number }) => {
      const pid = Number(data?.projectId);
      if (!Number.isInteger(pid)) return;
      const hasAccess = await canAccessProject(user, pid);
      if (hasAccess) socket.join(ROOMS.project(pid));
    });
    socket.on("room:leave", ({ projectId }: { projectId: number }) => {
      socket.leave(ROOMS.project(Number(projectId)));
    });

    socket.on("disconnect", () => {
      const s = onlineUsers.get(user.id);
      if (s) {
        s.delete(socket.id);
        if (s.size === 0) onlineUsers.delete(user.id);
      }
      emitPresence();
      socket.to(ROOMS.admin).emit("user:disconnected", { id: user.id, name: user.name });
    });
  });

  return io;
}

export function getOnlineCount(): number {
  return onlineUsers.size;
}

export function emitPresence() {
  getIO()
    .to(ROOMS.admin)
    .emit("presence:update", {
      count: onlineUsers.size,
      users: Array.from(onlineUsers.keys()).map((id) => ({ id })),
    });
}

/** Broadcast a task update to everyone currently viewing that project room */
export function emitTaskUpdate(task: Task) {
  getIO().to(ROOMS.project(task.projectId)).emit("task:updated", task);
}

/** Broadcast role-scoped activity to admin room, project room, and assigned dev room */
export function emitActivity(event: ActivityEvent & { actor: { name: string } }, assigneeId?: number | null) {
  const payload = {
    ...event,
    actorName: event.actor.name,
  };
  getIO().to(ROOMS.admin).emit("activity:new", payload);
  getIO().to(ROOMS.project(event.projectId)).emit("activity:new", payload);
  if (assigneeId) {
    getIO().to(ROOMS.user(assigneeId)).emit("activity:new", payload);
  }
}

/** Push a notification to its recipient and refresh their unread count */
export async function emitNotification(notification: Notification & { user?: undefined }) {
  const io = getIO();
  io.to(ROOMS.user(notification.userId)).emit("notification:new", notification);
  const unread = await prisma.notification.count({
    where: { userId: notification.userId, isRead: false },
  });
  io.to(ROOMS.user(notification.userId)).emit("notification:unread", unread);
}

/** Re-push unread count after read actions */
export async function emitUnreadCount(userId: number) {
  const unread = await prisma.notification.count({ where: { userId, isRead: false } });
  getIO().to(ROOMS.user(userId)).emit("notification:unread", unread);
}

async function canAccessProject(
  user: { id: number; role: string; name: string; email: string },
  projectId: number
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role === "PROJECT_MANAGER") {
    const p = await prisma.project.findFirst({ where: { id: projectId, managerId: user.id } });
    return !!p;
  }
  // Developer: only projects containing a task assigned to them
  const t = await prisma.task.findFirst({ where: { projectId, assignedToId: user.id } });
  return !!t;
}
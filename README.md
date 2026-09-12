# Velozity Dashboard

Real-time client project dashboard with **role-based access**, a **live activity feed**, and **WebSocket-powered notifications** — built for the Velozity Global Solutions Full Stack Developer technical hiring assessment.

> **Roles** · Admin sees everything, Project Managers manage their own projects, Developers see only tasks assigned to them. Access is enforced **server-side on every route** (a Developer cannot reach a PM's data even with a forged token).

## Live deployment

| Piece | URL |
| --- | --- |
| **Frontend (Vercel)** | https://frontend-one-psi-78.vercel.app |
| **Backend API · WebSocket (Render)** | https://velozity-backend-7c25.onrender.com |

Hosting: frontend built with `VITE_API_URL`/`VITE_WS_URL` → the Render backend; Render runs the same Docker image as local via `render.yaml` (blueprint: `velozity-backend` web service + free Postgres `velozity-db`, `CLIENT_URL` = Vercel origin for Socket.IO CORS). Free-tier tips: Render spins down after ~15 min idle (first request after sleep can take ~30–60s); the cron/overdue job resumes once the instance wakes.

Demo logins — **admin@velozity.com / Admin@1234**, **yug@velozity.com / Yug@1234** (Admins); **pm1@velozity.com / Pm@1234** & **pm2@velozity.com / Pm@1234** (PMs); **dev1–dev4@velozity.com / Dev@1234** (Developers).

## Features

| Area | What it does |
| --- | --- |
| **Auth** | JWT access token + refresh token stored in an **HttpOnly cookie** (never `localStorage`). Single-flight silent refresh. Role loaded from DB on every request — the JWT role claim is never trusted. |
| **Roles** | Admin (all), PM (own projects only), Developer (own tasks, status updates only). `requireRole`, `buildRoleScopedWhere`, `canAccessProject`, `canAccessTask` enforced at the API level. |
| **Projects & tasks** | Projects belong to a client + one PM. Tasks carry title, description, assignee, status (To Do / In Progress / In Review / Done), priority, due date, and a **persisted activity log**. PM can only manage projects they created. |
| **Overdue** | `node-cron` background job flags tasks past their due date as **Overdue** (persisted, written to the feed/notifications). Not computed on page load. |
| **Live activity feed** | Socket.IO. `"Ravi moved Task #12 from In Progress → In Review · 2 mins ago"`. Admin = global feed; PM = own projects; Developer = own tasks. Offline users get the last 20 missed events from the **database** on reconnect (`GET /api/activity?after=<id>`), never from in-memory cache. |
| **Dashboards** | Admin: totals, tasks by status/priority, overdue count, **live online-user count via WebSocket presence**. PM: their projects, tasks by priority, due dates this week. Developer: tasks sorted by priority then due date. |
| **Filters** | Status / priority / due-date range / search live in **URL query parameters** → shareable, bookmarkable links. |
| **Notifications** | In-app bell with unread badge + dropdown; mark one or all read; unread count updates **over WebSocket** (assignment → developer; In Review → PM). |

## Tech stack & choices

- **Frontend:** React 18 + TypeScript + Vite + Axios + Socket.IO client. No UI kit — hand-rolled CSS, context-based state with URL as the filter source of truth.
- **Backend:** **Express** (the Leanest ecosystem for this scope; small, boring, easy to read). Chosen over Fastify for ubiquity and zero-friction deployment. TypeScript throughout.
- **Database:** PostgreSQL via **Prisma** ORM (no raw SQL mixed into controllers, no NoSQL).
- **Real-time:** **Socket.IO** (chosen over raw WebSocket — see "Architecture decisions").
- **Jobs:** **node-cron** (in-process scheduler; a Bull/Redis queue is only worth the operational cost at multi-instance scale).
- **Validation:** Zod schemas on every request body/query on the server; errors are structured `{ error: { code, message, details } }` — no stack traces leak.
- **Secrets:** all in `.env` via `dotenv`. Never hardcoded.

## Quick start (Docker — recommended)

```bash
docker compose up --build
```

Then open **http://localhost:8080**.

- `db` → PostgreSQL 16 (localhost:5432)
- `backend` → API + WebSocket + cron on localhost:4000
- `frontend` → Nginx serving the built SPA on http://localhost:8080, proxying `/api` and `/socket.io` to the backend

The backend container automatically runs `prisma db push` + the seed script on first boot.

### Demo credentials (seeded)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@velozity.com` | `Admin@1234` |
| PM 1 | `pm1@velozity.com` | `Pm@1234` |
| PM 2 | `pm2@velozity.com` | `Pm@1234` |
| Developers | `dev1@velozity.com` … `dev4@velozity.com` | `Dev@1234` |

**Seed data:** 1 Admin, 2 PMs, 4 Developers · 3 projects (Website Redesign, Mobile App MVP, Patient Portal) with 5–7 tasks each in various statuses · 2+ tasks already Overdue · pre-existing activity events and notifications so the feed/bell aren't empty on first load.

## Manual setup (no Docker)

Prereqs: Node 20+, PostgreSQL 14+.

```bash
# 1. Database
createdb velozity            # or use an existing instance

# 2. Backend
cd backend
cp .env.example .env         # set DATABASE_URL, secrets
npm install
npm run setup                # prisma generate + db push + seed
npm run dev                  # API + WebSocket → http://localhost:4000

# 3. Frontend (in a second terminal)
cd frontend
npm install
npm run dev                  # → http://localhost:5173 (proxies /api + /socket.io to :4000)
```

## Database schema & indexing

```
User ──1:N── Project (managerId)            Client ──1:N── Project
Project ──1:N── Task                        Task ──N:1── User (assignedToId, developer)
ActivityEvent (actor/user, project, task? — who/what/when, persisted)
Notification (recipient user, actor?, task?, project?)
```

Every foreign key is a real Prisma relation with `@relation`; cascades are avoided so deletions are explicit.

**Indexes and why:**
- `Task.projectId`, `Task.assignedToId`, `Task.status`, `Task.priority`, `Task.dueDate` — the task list is queried by every one of these (`managerId` through the project relation), including the overdue scheduler's `WHERE dueDate < now AND status != DONE`.
- `ActivityEvent(projectId, createdAt)`, `ActivityEvent(actorId, createdAt)`, `ActivityEvent(taskId, createdAt)` — the role-scoped feeds are exactly these three query shapes (admin = all by time, PM = by project, dev = by task).
- `Notification(userId, isRead, createdAt)` — unread-count and list queries.
- `Project(managerId)`, `Project(clientId)` — "own projects" scoping.

→ schema: `backend/prisma/schema.prisma`

## Architecture decisions

**WebSocket library — Socket.IO instead of raw `ws`.** Two reasons. (1) *Engineering:* it gives me rooms, automatic reconnection with staggering, and `auth` on the handshake out of the box — the role-filtered feed maps naturally onto three room kinds: `admin`, `project:<id>`, `user:<id>`. (2) *Operational:* socket.io's built-in HTTP long-polling fallback means the app still works behind proxies/balancers that mangle WebSocket upgrades (relevant on managed hosts).

**Token storage — JWT access + refresh.** Short-lived (15 min) access token held in JS memory for API/WS auth; the refresh token lives in a `HttpOnly; SameSite=Lax; Path=/api/auth` cookie so it's invisible to XSS and sent only to the auth endpoints. On 401 the client performs a **single-flight** refresh (concurrent 401s share one request) and replays the original call.

**Job queue — node-cron** for the 5-minute overdue sweep. The job persists `isOverdue` and writes feed/notification rows. A Bull/Redis queue would sub-in cleanly behind the same `flagOverdueTasks()` function if multi-instance processing is ever needed.

**Why Express** over Fastify: smallest surface area for a task of this size, huge ecosystem, zero friction on Vercel/any Node host, and the codebase stays boringly readable.

**Realtime presence** is handled with an in-memory userId → socketId set on the server, broadcast to the admin room as `presence:update`. This is correct for a single WebSocket process (see limitations).

## Real-time role-filtered feed — how offline catch-up works

Events are persisted as `ActivityEvent` rows. On connect, Socket.IO **rooms** deliver events in real time to exactly the audiences in the matrix (admin room / project rooms PMs auto-join / assignee user room for Developers). The client links every feed to `GET /api/activity`, which applies the same role scoping server-side. While disconnected, the client records the last received event `id`; on reconnect it calls `GET /api/activity?after=<id>` and merges the missed rows (last 20) back into the UI. Because events are read from the database with the same role filter, a Developer still cannot replay another user's activity.

## Known limitations

- **Socket.IO presence is per-process.** With multiple backend instances you'd need the Socket.IO Redis adapter; fine for a single-instance deployment.
- **Vercel hosts Node as serverless functions** — Socket.IO keeps a long-lived connection, so the WebSocket server is better deployed on a persistent host you control (Render / Railway / Fly.io / a VPS, or the included Docker compose). The SPA itself deploys to Vercel cleanly; point `VITE_API_URL` / `VITE_WS_URL` at the hosted backend.
- Access tokens aren't stored, so a full page reload requires the refresh round-trip (a few ms, transparent to the user).
- Seed message text for a few status-change events is intentionally simplified; real user actions always write structured history.

---

## Explanation (150–250 words)

The hardest problem was the **role-scoped real-time feed**: one stream of events, three different audiences, and no way to push to some users but not others. The trick was realising the visibility rules map to fixed audiences — admins see everything, PMs see their projects, and developers see their own tasks — so I designed Socket.IO around those audiences rather than trying to filter on the client: an `admin` room, one room per `project:<id>` that PMs auto-join, and a per-user room for assignees. The trickiest part was offline catch-up, because if you replay events from RAM you risk leaking events the user wasn't entitled to see. Every event is therefore a row in `ActivityEvent`, and the client's reconnect path calls `GET /api/activity?after=<lastId>`, which re-runs the same role-filtered query against the database, capping at the last 20 missed events.

The second-hardest part was making role security the server's job everywhere, not the UI's. `authenticate` reloads the user from the DB before touching a request, and every route re-validates ownership, so a modified JWT or a direct API call changes nothing — a Developer asking for tasks returns only their own.

If I did it again, I would add the Socket.IO Redis adapter and use Postgres LISTEN/NOTIFY behind it, so presence and feeds survive multiple backend instances without re-architecting — accepted as a limitation here for a single-instance demo.
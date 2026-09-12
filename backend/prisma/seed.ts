import { PrismaClient, Role, TaskStatus, TaskPriority, ActivityType, NotificationType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  console.log("Cleaning existing data...");
  await prisma.notification.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const hash = (p: string) => bcrypt.hash(p, 10);

  // ── Users: 1 Admin, 2 PMs, 4 Developers
  const admin = await prisma.user.create({
    data: { email: "admin@velozity.com", name: "Alex Admin", passwordHash: await hash("Admin@1234"), role: Role.ADMIN },
  });
  const pm1 = await prisma.user.create({
    data: { email: "pm1@velozity.com", name: "Priya Project", passwordHash: await hash("Pm@1234"), role: Role.PROJECT_MANAGER },
  });
  const pm2 = await prisma.user.create({
    data: { email: "pm2@velozity.com", name: "Ravi Manager", passwordHash: await hash("Pm@1234"), role: Role.PROJECT_MANAGER },
  });
  const dev1 = await prisma.user.create({
    data: { email: "dev1@velozity.com", name: "Divya Developer", passwordHash: await hash("Dev@1234"), role: Role.DEVELOPER },
  });
  const dev2 = await prisma.user.create({
    data: { email: "dev2@velozity.com", name: "Dev Kumar", passwordHash: await hash("Dev@1234"), role: Role.DEVELOPER },
  });
  const dev3 = await prisma.user.create({
    data: { email: "dev3@velozity.com", name: "David Dev", passwordHash: await hash("Dev@1234"), role: Role.DEVELOPER },
  });
  const dev4 = await prisma.user.create({
    data: { email: "dev4@velozity.com", name: "Dana Devastator", passwordHash: await hash("Dev@1234"), role: Role.DEVELOPER },
  });

  console.log("Users created.");

  // ── Clients
  const clientA = await prisma.client.create({ data: { name: "Acme Corp", company: "Acme Industries", contactEmail: "ops@acme.com" } });
  const clientB = await prisma.client.create({ data: { name: "Beta Retail", company: "Beta Stores Ltd", contactEmail: "partners@beta.com" } });
  const clientC = await prisma.client.create({ data: { name: "Gamma Health", company: "Gamma Health Group", contactEmail: "it@gammahealth.com" } });

  const pmName = (id: number) => (id === pm1.id ? "Priya Project" : "Ravi Manager");

  async function buildProject(opts: {
    name: string;
    description: string;
    clientId: number;
    managerId: number;
    tasks: Array<{
      title: string;
      description: string;
      assignee: number;
      status: TaskStatus;
      priority: TaskPriority;
      dueOffsetDays: number;
    }>;
  }) {
    const { tasks, ...proj } = opts;
    const project = await prisma.project.create({
      data: { name: proj.name, description: proj.description, clientId: proj.clientId, managerId: proj.managerId },
    });

    // Project creation activity (no taskId)
    await prisma.activityEvent.create({
      data: {
        actorId: proj.managerId,
        projectId: project.id,
        type: ActivityType.PROJECT_CREATED,
        message: `${pmName(proj.managerId)} created project "${proj.name}"`,
      },
    });

    const createdTasks: Array<{ id: number; title: string; assigneeId: number | null }> = [];
    for (const t of tasks) {
      const due = new Date(Date.now() + t.dueOffsetDays * DAY);
      const task = await prisma.task.create({
        data: {
          title: t.title,
          description: t.description,
          projectId: project.id,
          assignedToId: t.assignee,
          status: t.status,
          priority: t.priority,
          dueDate: due,
          isOverdue: due < new Date() && t.status !== TaskStatus.DONE,
        },
      });
      createdTasks.push({ id: task.id, title: task.title, assigneeId: task.assignedToId });

      await prisma.activityEvent.create({
        data: {
          actorId: proj.managerId,
          projectId: project.id,
          taskId: task.id,
          type: ActivityType.TASK_CREATED,
          message: `${pmName(proj.managerId)} created Task #${task.id}: ${t.title}`,
        },
      });

      // Simulate status-change history so the task log isn't empty
      if (t.status !== TaskStatus.TO_DO) {
        const devName = await prisma.user.findUnique({ where: { id: t.assignee }, select: { name: true } });
        const label = t.status === TaskStatus.DONE ? "Done" : t.status.replace("_", " ");
        await prisma.activityEvent.create({
          data: {
            actorId: t.assignee,
            projectId: project.id,
            taskId: task.id,
            type: ActivityType.TASK_STATUS_CHANGED,
            message: `${devName?.name} moved Task #${task.id} from To Do → ${label}`,
          },
        });
      }
    }
    console.log(`Project seeded: ${proj.name}`);
    return { project, tasks: createdTasks };
  }

  // ── 3 projects, 5+ tasks each, 2+ overdue
  const p1 = await buildProject({
    name: "Website Redesign",
    description: "Full redesign of the Acme Corp marketing website.",
    clientId: clientA.id,
    managerId: pm1.id,
    tasks: [
      { title: "Design homepage wireframes", description: "Desktop + mobile wireframes for the new homepage", assignee: dev1.id, status: TaskStatus.DONE, priority: TaskPriority.HIGH, dueOffsetDays: -25 },
      { title: "Set up design tokens", description: "Color, typography and spacing tokens", assignee: dev2.id, status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, dueOffsetDays: -18 },
      { title: "Implement header & nav", description: "Sticky responsive navigation bar", assignee: dev1.id, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, dueOffsetDays: -2 },
      { title: "Blog listing page", description: "List view with pagination and search", assignee: dev3.id, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, dueOffsetDays: 3 },
      { title: "Checkout flow rebuild", description: "Reduce checkout steps from 4 to 2", assignee: dev2.id, status: TaskStatus.IN_REVIEW, priority: TaskPriority.CRITICAL, dueOffsetDays: 1 },
      { title: "Accessibility pass", description: "WCAG 2.1 AA compliance audit", assignee: dev4.id, status: TaskStatus.TO_DO, priority: TaskPriority.MEDIUM, dueOffsetDays: 6 },
      { title: "Performance audit", description: "Lighthouse + Core Web Vitals", assignee: dev3.id, status: TaskStatus.TO_DO, priority: TaskPriority.LOW, dueOffsetDays: 10 },
    ],
  });

  const p2 = await buildProject({
    name: "Mobile App MVP",
    description: "React Native iOS/Android MVP for Beta Retail.",
    clientId: clientB.id,
    managerId: pm1.id,
    tasks: [
      { title: "Auth screens", description: "Login, signup and OTP screens", assignee: dev2.id, status: TaskStatus.DONE, priority: TaskPriority.HIGH, dueOffsetDays: -12 },
      { title: "Product catalog API client", description: "Typed API layer for product data", assignee: dev4.id, status: TaskStatus.IN_REVIEW, priority: TaskPriority.HIGH, dueOffsetDays: -1 },
      { title: "Search & filter screen", description: "Full-text search with category filters", assignee: dev1.id, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, dueOffsetDays: 4 },
      { title: "Push notification setup", description: "FCM integration and device token registration", assignee: dev3.id, status: TaskStatus.TO_DO, priority: TaskPriority.MEDIUM, dueOffsetDays: 8 },
      { title: "Offline cart sync", description: "Local storage backed sync queue", assignee: dev2.id, status: TaskStatus.TO_DO, priority: TaskPriority.CRITICAL, dueOffsetDays: -2 },
      { title: "Payment gateway", description: "Stripe integration for card payments", assignee: dev4.id, status: TaskStatus.TO_DO, priority: TaskPriority.HIGH, dueOffsetDays: 12 },
    ],
  });

  const p3 = await buildProject({
    name: "Patient Portal",
    description: "Gamma Health patient portal and medical records.",
    clientId: clientC.id,
    managerId: pm2.id,
    tasks: [
      { title: "HIPAA compliance review", description: "Legal + technical review of data handling", assignee: dev1.id, status: TaskStatus.DONE, priority: TaskPriority.CRITICAL, dueOffsetDays: -10 },
      { title: "Records API", description: "REST API for medical records access", assignee: dev2.id, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, dueOffsetDays: -3 },
      { title: "Appointment booking", description: "Calendar integration and booking flow", assignee: dev3.id, status: TaskStatus.TO_DO, priority: TaskPriority.MEDIUM, dueOffsetDays: 5 },
      { title: "Lab results view", description: "PDF rendering + trend visualization", assignee: dev4.id, status: TaskStatus.TO_DO, priority: TaskPriority.MEDIUM, dueOffsetDays: 9 },
      { title: "Prescription refills", description: "Self-service refill request flow", assignee: dev1.id, status: TaskStatus.TO_DO, priority: TaskPriority.LOW, dueOffsetDays: 15 },
    ],
  });

  // ── Pre-existing notifications so the bell isn't empty (uses real task ids)
  const headerNav = p1.tasks.find((t) => t.title === "Implement header & nav");
  const checkout = p1.tasks.find((t) => t.title === "Checkout flow rebuild");
  const pushNotif = p2.tasks.find((t) => t.title === "Push notification setup");
  if (headerNav && checkout && pushNotif) {
    await prisma.notification.createMany({
      data: [
        {
          userId: dev1.id,
          actorId: pm1.id,
          taskId: headerNav.id,
          type: NotificationType.TASK_ASSIGNED,
          message: `Priya Project assigned Task #${headerNav.id} (${headerNav.title}) to you`,
        },
        {
          userId: dev2.id,
          actorId: pm1.id,
          taskId: checkout.id,
          type: NotificationType.TASK_IN_REVIEW,
          message: `Priya Project moved Task #${checkout.id} (${checkout.title}) to In Review`,
          isRead: true,
        },
        {
          userId: dev3.id,
          actorId: pm1.id,
          taskId: pushNotif.id,
          type: NotificationType.TASK_ASSIGNED,
          message: `Priya Project assigned Task #${pushNotif.id} (${pushNotif.title}) to you`,
        },
      ],
    });
  }

  console.log("\n┌─────────────────────────────────────┐");
  console.log("│  Seed complete ✔                    │");
  console.log("│  Admin: admin@velozity.com/Admin@1234│");
  console.log("│  PM1:   pm1@velozity.com/Pm@1234     │");
  console.log("│  PM2:   pm2@velozity.com/Pm@1234     │");
  console.log("│  Devs:  dev1..4@velozity.com/Dev@1234│");
  console.log("└─────────────────────────────────────┘");
  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
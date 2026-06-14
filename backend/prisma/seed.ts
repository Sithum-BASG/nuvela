import { PrismaClient, Role, UserStatus, Priority } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createDefaultColumns } from './columns';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Seed123!', 10);

  // Org
  const org = await prisma.organization.create({ data: { name: 'Acme Co' } });

  // Users (all ACTIVE + verified for demo use)
  const owner = await prisma.user.create({
    data: { organizationId: org.id, email: 'owner@acme.test', name: 'Olivia Owner', passwordHash, role: Role.OWNER, status: UserStatus.ACTIVE, emailVerified: true },
  });
  await prisma.organization.update({ where: { id: org.id }, data: { ownerId: owner.id } });

  await prisma.user.create({
    data: { organizationId: org.id, email: 'admin@acme.test', name: 'Adam Admin', passwordHash, role: Role.ADMIN, status: UserStatus.ACTIVE, emailVerified: true },
  });
  const pm1 = await prisma.user.create({
    data: { organizationId: org.id, email: 'pm1@acme.test', name: 'Priya Manager', passwordHash, role: Role.PROJECT_MANAGER, status: UserStatus.ACTIVE, emailVerified: true },
  });
  const pm2 = await prisma.user.create({
    data: { organizationId: org.id, email: 'pm2@acme.test', name: 'Paul Manager', passwordHash, role: Role.PROJECT_MANAGER, status: UserStatus.ACTIVE, emailVerified: true },
  });
  const collabs = await Promise.all(
    ['cara', 'cole', 'cody'].map((n) =>
      prisma.user.create({
        data: { organizationId: org.id, email: `${n}@acme.test`, name: `${n[0].toUpperCase()}${n.slice(1)} Collaborator`, passwordHash, role: Role.COLLABORATOR, status: UserStatus.ACTIVE, emailVerified: true },
      }),
    ),
  );

  // Project 1 (pm1) + columns via the shared function
  const p1 = await prisma.project.create({
    data: { organizationId: org.id, name: 'Website Revamp', description: 'Marketing site refresh', color: '#7c74d6', managerId: pm1.id },
  });
  await createDefaultColumns(prisma, p1.id);
  const p1cols = await prisma.column.findMany({ where: { projectId: p1.id }, orderBy: { position: 'asc' } });

  // Project 2 (pm2) + columns
  const p2 = await prisma.project.create({
    data: { organizationId: org.id, name: 'Mobile App', description: 'iOS/Android build', color: '#2f855a', managerId: pm2.id },
  });
  await createDefaultColumns(prisma, p2.id);
  const p2cols = await prisma.column.findMany({ where: { projectId: p2.id }, orderBy: { position: 'asc' } });

  // Memberships: two collabs in p1; one collab in p2
  await prisma.projectMember.createMany({
    data: [
      { projectId: p1.id, userId: collabs[0].id },
      { projectId: p1.id, userId: collabs[1].id },
      { projectId: p2.id, userId: collabs[2].id },
    ],
  });

  // Labels (per project)
  const bug = await prisma.label.create({ data: { projectId: p1.id, name: 'Bug', color: '#c53030' } });
  const feature = await prisma.label.create({ data: { projectId: p1.id, name: 'Feature', color: '#5a52b5' } });

  // Tasks across columns/priorities (some unassigned, some multi-assigned, one completed)
  await prisma.task.create({
    data: { organizationId: org.id, projectId: p1.id, columnId: p1cols[0].id, title: 'Design homepage hero', priority: Priority.HIGH, position: 0, createdById: pm1.id,
      assignees: { create: [{ userId: collabs[0].id }] },
      labels: { create: [{ labelId: feature.id }] },
      checklist: { create: [{ text: 'Draft copy', isChecked: true, position: 0 }, { text: 'Pick imagery', isChecked: false, position: 1 }] } },
  });
  await prisma.task.create({
    data: { organizationId: org.id, projectId: p1.id, columnId: p1cols[1].id, title: 'Fix nav overlap on mobile', priority: Priority.MEDIUM, position: 0, createdById: pm1.id,
      assignees: { create: [{ userId: collabs[0].id }, { userId: collabs[1].id }] },
      labels: { create: [{ labelId: bug.id }] } },
  });
  await prisma.task.create({
    data: { organizationId: org.id, projectId: p1.id, columnId: p1cols[2].id, title: 'Review footer links', priority: Priority.LOW, position: 0, createdById: pm1.id,
      assignees: { create: [{ userId: collabs[1].id }] } },
  });
  await prisma.task.create({
    data: { organizationId: org.id, projectId: p1.id, columnId: p1cols[0].id, title: 'Audit analytics tags', priority: Priority.LOW, position: 1, createdById: pm1.id },
  });
  await prisma.task.create({
    data: { organizationId: org.id, projectId: p1.id, columnId: p1cols[3].id, title: 'Set up staging domain', priority: Priority.MEDIUM, position: 0, createdById: pm1.id,
      assignees: { create: [{ userId: collabs[0].id }] } },
  });
  await prisma.task.create({
    data: { organizationId: org.id, projectId: p2.id, columnId: p2cols[0].id, title: 'Set up CI for app', priority: Priority.HIGH, position: 0, createdById: pm2.id,
      assignees: { create: [{ userId: collabs[2].id }] } },
  });
  await prisma.task.create({
    data: { organizationId: org.id, projectId: p2.id, columnId: p2cols[1].id, title: 'Implement login screen', priority: Priority.HIGH, position: 0, createdById: pm2.id,
      assignees: { create: [{ userId: collabs[2].id }] } },
  });
  await prisma.task.create({
    data: { organizationId: org.id, projectId: p2.id, columnId: p2cols[0].id, title: 'Choose state management', priority: Priority.MEDIUM, position: 1, createdById: pm2.id },
  });

  console.log(`Seeded org ${org.id}: 7 users, 2 projects, 8 columns, 8 tasks, 2 labels.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

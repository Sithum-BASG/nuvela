import { PrismaClient, Prisma } from '@prisma/client';

// The single source of truth for a project's board columns.
// To Do (0) → In Progress (1) → Review (2) → Completed (3, completed + PM-gated).
export const DEFAULT_COLUMNS: ReadonlyArray<{
  name: string;
  position: number;
  isCompletedColumn: boolean;
  isPmGated: boolean;
}> = [
  { name: 'To Do', position: 0, isCompletedColumn: false, isPmGated: false },
  { name: 'In Progress', position: 1, isCompletedColumn: false, isPmGated: false },
  { name: 'Review', position: 2, isCompletedColumn: false, isPmGated: false },
  { name: 'Completed', position: 3, isCompletedColumn: true, isPmGated: true },
];

// Creates the four default columns for a project. Accepts a PrismaClient or a
// transaction client so it can run inside project-creation transactions later.
export async function createDefaultColumns(
  db: PrismaClient | Prisma.TransactionClient,
  projectId: string,
) {
  await db.column.createMany({
    data: DEFAULT_COLUMNS.map((c) => ({ ...c, projectId })),
  });
}

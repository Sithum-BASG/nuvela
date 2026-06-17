import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// The four default board columns every project gets at creation, in order.
// Shared by project creation and the seed script so the board shape stays
// identical everywhere (Implementation Plan §"Working conventions").
// Completed is the gated done-column: only the PM may move tasks into it.
export async function seedDefaultColumns(
  prisma: PrismaService,
  projectId: string,
): Promise<void> {
  await prisma.column.createMany({
    data: [
      {
        projectId,
        name: 'To Do',
        position: 0,
        isCompletedColumn: false,
        isPmGated: false,
      },
      {
        projectId,
        name: 'In Progress',
        position: 1,
        isCompletedColumn: false,
        isPmGated: false,
      },
      {
        projectId,
        name: 'Review',
        position: 2,
        isCompletedColumn: false,
        isPmGated: false,
      },
      {
        projectId,
        name: 'Completed',
        position: 3,
        isCompletedColumn: true,
        isPmGated: true,
      },
    ],
  });
}

@Injectable()
export class ColumnsService {
  constructor(private readonly prisma: PrismaService) {}

  // Injectable wrapper so ProjectsService can seed columns via DI while the
  // seed script calls the plain function directly.
  seedDefaultColumns(projectId: string): Promise<void> {
    return seedDefaultColumns(this.prisma, projectId);
  }
}

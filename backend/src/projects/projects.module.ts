import { Module } from '@nestjs/common';
import { ColumnsModule } from '../columns/columns.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule, ColumnsModule],
  controllers: [ProjectsController, MembersController],
  providers: [ProjectsService, MembersService],
})
export class ProjectsModule {}

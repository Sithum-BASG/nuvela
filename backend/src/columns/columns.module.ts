import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ColumnsService } from './columns.service';

@Module({
  imports: [PrismaModule],
  providers: [ColumnsService],
  exports: [ColumnsService],
})
export class ColumnsModule {}

import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { DeadlineScanner } from './deadline.scanner';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService, DeadlineScanner],
  exports: [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}

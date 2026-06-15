import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ALLOW_WHILE_MUST_RESET_KEY } from '../decorators/allow-while-must-reset.decorator';
import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

type RequestWithCurrentUser = Request & {
  user?: CurrentUserPayload;
};

@Injectable()
export class MustResetGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const allowWhileMustReset = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WHILE_MUST_RESET_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowWhileMustReset) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();
    const userId = request.user?.userId;

    if (!userId) {
      return true;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mustResetPassword: true },
    });

    if (user?.mustResetPassword) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'MUST_RESET_PASSWORD',
        message: 'Reset your temporary password before continuing.',
      });
    }

    return true;
  }
}

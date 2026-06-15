import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import type { Request } from 'express';

type RequestWithCurrentUser = Request & {
  user?: CurrentUserPayload;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();
    const user = request.user;

    if (!user) {
      throw forbidden();
    }

    // OWNER is a superset for gated routes per TRD auth/RBAC section.
    if (user.role === Role.OWNER || requiredRoles.includes(user.role)) {
      return true;
    }

    throw forbidden();
  }
}

function forbidden(): ForbiddenException {
  return new ForbiddenException({
    code: 'FORBIDDEN',
    message: 'Forbidden.',
  });
}

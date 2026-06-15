import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';

export type CurrentUserPayload = {
  userId: string;
  role: Role;
  organizationId: string;
};

type RequestWithCurrentUser = Request & {
  user?: CurrentUserPayload;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserPayload => {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();
    return request.user as CurrentUserPayload;
  },
);

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import type { AuthTokenPayload } from './token.service';

type RequestWithCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      // Access token is read from the HTTP-only cookie per TRD auth section.
      jwtFromRequest: ExtractJwt.fromExtractors([accessTokenFromCookie]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: AuthTokenPayload): CurrentUserPayload {
    return {
      userId: payload.sub,
      role: payload.role,
      organizationId: payload.organizationId,
    };
  }
}

function accessTokenFromCookie(
  request: RequestWithCookies | null,
): string | null {
  const cookies = (request?.cookies ?? {}) as Record<
    string,
    string | undefined
  >;
  return cookies.access_token ?? null;
}

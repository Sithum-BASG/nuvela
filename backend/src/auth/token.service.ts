import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { comparePassword, hashPassword } from './password.util';
import { PrismaService } from '../prisma/prisma.service';

export type AuthTokenPayload = {
  sub: string;
  role: Role;
  organizationId: string;
};

export type AuthTokens = {
  access: string;
  refresh: string;
};

type JwtDuration = `${number}${'s' | 'm' | 'h' | 'd'}`;

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async signAccess(payload: AuthTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.getAccessSecret(),
      expiresIn: this.getAccessExpiry(),
    });
  }

  async signRefresh(payload: AuthTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: this.getRefreshExpiry(),
      keyid: randomUUID(),
    });
  }

  setAuthCookies(res: Response, tokens: AuthTokens): void {
    res.cookie(ACCESS_COOKIE, tokens.access, {
      ...this.cookieOptions(),
      maxAge: parseDurationMs(this.getAccessExpiry()),
    });
    res.cookie(REFRESH_COOKIE, tokens.refresh, {
      ...this.cookieOptions(),
      maxAge: parseDurationMs(this.getRefreshExpiry()),
    });
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, this.cookieOptions());
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  async persistRefreshToken(userId: string, rawRefresh: string): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: await hashPassword(rawRefresh),
        expiresAt: new Date(
          Date.now() + parseDurationMs(this.getRefreshExpiry()),
        ),
      },
    });
  }

  async rotateRefreshToken(
    userId: string,
    rawOld: string,
  ): Promise<AuthTokens> {
    const payload = await this.verifyRefresh(rawOld);

    if (payload.sub !== userId) {
      throw invalidRefresh();
    }

    const matchingTokenId = await this.findMatchingRefreshToken(userId, rawOld);
    if (!matchingTokenId) {
      throw invalidRefresh();
    }

    await this.prisma.refreshToken.update({
      where: { id: matchingTokenId },
      data: { revokedAt: new Date() },
    });

    const tokens = {
      access: await this.signAccess(payload),
      refresh: await this.signRefresh(payload),
    };
    await this.persistRefreshToken(userId, tokens.refresh);

    return tokens;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeRefreshToken(userId: string, rawRefresh: string): Promise<void> {
    const matchingTokenId = await this.findMatchingRefreshToken(
      userId,
      rawRefresh,
    );

    if (!matchingTokenId) {
      return;
    }

    await this.prisma.refreshToken.update({
      where: { id: matchingTokenId },
      data: { revokedAt: new Date() },
    });
  }

  /** Best-effort user id from a refresh cookie; null when invalid or expired. */
  async tryResolveUserIdFromRefresh(
    rawRefresh: string,
  ): Promise<string | null> {
    try {
      const payload = await this.verifyRefresh(rawRefresh);
      return payload.sub;
    } catch {
      return null;
    }
  }

  private async verifyRefresh(rawRefresh: string): Promise<AuthTokenPayload> {
    try {
      // jwt adds iat/exp to the decoded token; return a clean payload so
      // re-signing in rotateRefreshToken doesn't clash with expiresIn.
      const decoded = await this.jwtService.verifyAsync<
        AuthTokenPayload & { iat?: number; exp?: number }
      >(rawRefresh, { secret: this.getRefreshSecret() });
      return {
        sub: decoded.sub,
        role: decoded.role,
        organizationId: decoded.organizationId,
      };
    } catch {
      throw invalidRefresh();
    }
  }

  private async findMatchingRefreshToken(
    userId: string,
    rawRefresh: string,
  ): Promise<string | null> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    for (const candidate of candidates) {
      if (await comparePassword(rawRefresh, candidate.tokenHash)) {
        return candidate.id;
      }
    }

    return null;
  }

  private getAccessSecret(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private getRefreshSecret(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private getAccessExpiry(): JwtDuration {
    return this.configService.get<JwtDuration>('JWT_ACCESS_EXPIRY') ?? '15m';
  }

  private getRefreshExpiry(): JwtDuration {
    return this.configService.get<JwtDuration>('JWT_REFRESH_EXPIRY') ?? '7d';
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
    };
  }
}

function invalidRefresh(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_REFRESH',
    message: 'Invalid refresh token.',
  });
}

function parseDurationMs(duration: JwtDuration): number {
  const match = /^(\d+)([smhd])$/.exec(duration);

  if (!match) {
    throw new Error(`Unsupported duration: ${duration}`);
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import {
  assertPasswordComplexity,
  comparePassword,
  generateTempPassword,
  hashPassword,
} from './password.util';
import { TokenService } from './token.service';

describe('password utilities', () => {
  it('hashes and compares a password round-trip', async () => {
    const plain = 'StrongPass1';
    const hash = await hashPassword(plain);

    await expect(comparePassword(plain, hash)).resolves.toBe(true);
    await expect(comparePassword('WrongPass1', hash)).resolves.toBe(false);
    expect(hash).not.toBe(plain);
  });

  it('rejects weak passwords and accepts strong passwords', () => {
    const error = captureError(() => assertPasswordComplexity('weak'));

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'WEAK_PASSWORD',
    });

    expect(() => assertPasswordComplexity('StrongPass1')).not.toThrow();
  });

  it('generates a URL-safe temporary password with required character classes', () => {
    const password = generateTempPassword();

    expect(password).toHaveLength(16);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[-._~]/);
    expect(password).toMatch(/^[A-Za-z0-9._~-]+$/);
  });
});

describe('TokenService', () => {
  const accessSecret = 'test-access-secret';
  const refreshSecret = 'test-refresh-secret';
  const userId = 'user-1';
  const payload = {
    sub: userId,
    role: Role.ADMIN,
    organizationId: 'org-1',
  };

  const createService = () => {
    const rows: Array<{
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      revokedAt: Date | null;
    }> = [];

    const prisma = {
      refreshToken: {
        create: jest.fn(
          ({
            data,
          }: {
            data: { userId: string; tokenHash: string; expiresAt: Date };
          }) => {
            const row = {
              id: `refresh-${rows.length + 1}`,
              userId: data.userId,
              tokenHash: data.tokenHash,
              expiresAt: data.expiresAt,
              revokedAt: null,
            };
            rows.push(row);

            return Promise.resolve(row);
          },
        ),
        findMany: jest.fn(
          ({
            where,
          }: {
            where: {
              userId: string;
              revokedAt: null;
              expiresAt: { gt: Date };
            };
          }) =>
            Promise.resolve(
              rows.filter(
                (row) =>
                  row.userId === where.userId &&
                  row.revokedAt === where.revokedAt &&
                  row.expiresAt > where.expiresAt.gt,
              ),
            ),
        ),
        update: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: { revokedAt: Date };
          }) => {
            const row = rows.find((candidate) => candidate.id === where.id);
            if (row) {
              row.revokedAt = data.revokedAt;
            }

            return Promise.resolve(row);
          },
        ),
      },
    };

    const config = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') {
          return accessSecret;
        }
        if (key === 'JWT_REFRESH_SECRET') {
          return refreshSecret;
        }
        throw new Error(`Missing config ${key}`);
      }),
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'JWT_ACCESS_EXPIRY') {
          return '15m';
        }
        if (key === 'JWT_REFRESH_EXPIRY') {
          return '7d';
        }
        return fallback;
      }),
    };

    const service = new TokenService(
      new JwtService(),
      config as unknown as ConfigService,
      prisma as never,
    );

    return { service, prisma, rows };
  };

  it('rotates a refresh token by revoking the old row and returning a new pair', async () => {
    const { service, prisma, rows } = createService();
    const oldRefresh = await service.signRefresh(payload);
    await service.persistRefreshToken(userId, oldRefresh);

    const result = await service.rotateRefreshToken(userId, oldRefresh);

    expect(typeof result.access).toBe('string');
    expect(typeof result.refresh).toBe('string');
    expect(result.refresh).not.toBe(oldRefresh);
    expect(prisma.refreshToken.update).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].revokedAt).toBeInstanceOf(Date);
    expect(rows[1].tokenHash).not.toBe(result.refresh);
  });

  it('throws INVALID_REFRESH for a reused refresh token', async () => {
    const { service } = createService();
    const oldRefresh = await service.signRefresh(payload);
    await service.persistRefreshToken(userId, oldRefresh);
    await service.rotateRefreshToken(userId, oldRefresh);

    const reuse = await service
      .rotateRefreshToken(userId, oldRefresh)
      .then(() => undefined)
      .catch((error: unknown) => error);
    expect(reuse).toBeInstanceOf(UnauthorizedException);
    expect((reuse as UnauthorizedException).getResponse()).toMatchObject({
      code: 'INVALID_REFRESH',
    });
  });
});

function captureError(action: () => void): unknown {
  try {
    action();
    return undefined;
  } catch (error) {
    return error;
  }
}

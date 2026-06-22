import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import type { User } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertPasswordComplexity,
  comparePassword,
  generateTempPassword,
  hashPassword,
} from './password.util';
import { TokenService } from './token.service';
import type { AuthTokenPayload, AuthTokens } from './token.service';
import { FirstLoginResetPasswordDto } from './dto/first-login-reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

type PurposeTokenPayload = {
  sub: string;
  typ: 'verify' | 'reset';
};

export type AuthenticatedUser = {
  userId: string;
  role: Role;
  organizationId: string;
};

export type LoginResult = {
  tokens: AuthTokens;
  body: {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      organizationId: string;
    };
    mustResetPassword: boolean;
  };
};

export type CurrentUserResult = {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
  mustResetPassword: boolean;
};

export type ProvisionUserInput = {
  organizationId: string;
  email: string;
  name: string;
  role: Role;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async signup(dto: SignupDto): Promise<void> {
    assertPasswordComplexity(dto.password);
    const passwordHash = await hashPassword(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.orgName },
      });
      const owner = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: dto.email,
          name: dto.name,
          passwordHash,
          role: Role.OWNER,
          status: UserStatus.PENDING,
          emailVerified: false,
        },
      });

      await tx.organization.update({
        where: { id: organization.id },
        data: { ownerId: owner.id },
      });

      return owner;
    });

    // The verification email is essential — without it the Owner can never
    // activate the account. If it can't be sent, roll back the just-created
    // org + owner so no orphaned, unverifiable account is left behind and the
    // user can retry cleanly. (This is a compensating rollback of a signup that
    // never completed — not a hard delete of an established user.)
    try {
      const verificationToken = await this.signPurposeToken(user.id, 'verify');
      await this.mailService.sendVerificationEmail(
        user.email,
        this.buildFrontendLink('/verify-email', verificationToken),
      );
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id: user.organizationId },
          data: { ownerId: null },
        });
        await tx.user.delete({ where: { id: user.id } });
        await tx.organization.delete({ where: { id: user.organizationId } });
      });
      throw error;
    }
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const payload = await this.verifyPurposeToken(dto.token, 'verify');
    const result = await this.prisma.user.updateMany({
      where: { id: payload.sub },
      data: {
        emailVerified: true,
        status: UserStatus.ACTIVE,
      },
    });

    if (result.count === 0) {
      throw invalidPurposeToken();
    }
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.findUserByEmailAndPassword(dto.email, dto.password);

    if (!user) {
      throw invalidCredentials();
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email before logging in.',
      });
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DEACTIVATED',
        message: 'This account is deactivated.',
      });
    }

    const payload = this.toTokenPayload(user);
    const tokens = {
      access: await this.tokenService.signAccess(payload),
      refresh: await this.tokenService.signRefresh(payload),
    };
    await this.tokenService.persistRefreshToken(user.id, tokens.refresh);

    return {
      tokens,
      body: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        },
        mustResetPassword: user.mustResetPassword,
      },
    };
  }

  async getCurrentUser(userId: string): Promise<CurrentUserResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        mustResetPassword: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_SESSION',
        message: 'Session user was not found.',
      });
    }

    return user;
  }

  async updateAccount(
    user: AuthenticatedUser,
    dto: UpdateAccountDto,
  ): Promise<CurrentUserResult> {
    await this.prisma.user.update({
      where: { id: user.userId },
      data: { name: dto.name.trim() },
    });
    return this.getCurrentUser(user.userId);
  }

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const existingUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });

    if (
      !(await comparePassword(dto.currentPassword, existingUser.passwordHash))
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Current password is incorrect.',
      });
    }

    assertPasswordComplexity(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.userId },
      data: {
        passwordHash: await hashPassword(dto.newPassword),
        mustResetPassword: false,
        tempPasswordExpiresAt: null,
      },
    });
    await this.tokenService.revokeAllForUser(user.userId);
  }

  async provisionUser(input: ProvisionUserInput): Promise<User> {
    const tempPassword = generateTempPassword();
    const user = await this.prisma.user.create({
      data: {
        organizationId: input.organizationId,
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: await hashPassword(tempPassword),
        mustResetPassword: true,
        status: UserStatus.PENDING,
        emailVerified: true,
        tempPasswordExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    await this.mailService.sendTempPasswordEmail(
      input.email,
      tempPassword,
      `${frontendUrl.replace(/\/$/, '')}/login`,
    );

    return user;
  }

  async refresh(rawRefresh: string | undefined): Promise<AuthTokens> {
    if (!rawRefresh) {
      throw invalidRefresh();
    }

    const payload = await this.verifyRefreshToken(rawRefresh);
    return this.tokenService.rotateRefreshToken(payload.sub, rawRefresh);
  }

  async logout(
    user: AuthenticatedUser,
    rawRefresh: string | undefined,
  ): Promise<void> {
    if (rawRefresh) {
      await this.tokenService.revokeRefreshToken(user.userId, rawRefresh);
      return;
    }

    await this.tokenService.revokeAllForUser(user.userId);
  }

  async firstLoginResetPassword(
    user: AuthenticatedUser,
    dto: FirstLoginResetPasswordDto,
  ): Promise<void> {
    const existingUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });

    if (!existingUser.mustResetPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_RESET_NOT_REQUIRED',
        message: 'Password reset is not required for this account.',
      });
    }

    assertPasswordComplexity(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.userId },
      data: {
        passwordHash: await hashPassword(dto.newPassword),
        mustResetPassword: false,
        tempPasswordExpiresAt: null,
      },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        status: UserStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      return;
    }

    const resetToken = await this.signPurposeToken(user.id, 'reset');
    await this.mailService.sendPasswordResetEmail(
      user.email,
      this.buildFrontendLink('/reset-password', resetToken),
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const payload = await this.verifyPurposeToken(dto.token, 'reset');
    assertPasswordComplexity(dto.newPassword);

    const result = await this.prisma.user.updateMany({
      where: { id: payload.sub },
      data: {
        passwordHash: await hashPassword(dto.newPassword),
        mustResetPassword: false,
        tempPasswordExpiresAt: null,
      },
    });

    if (result.count === 0) {
      throw invalidPurposeToken();
    }

    await this.tokenService.revokeAllForUser(payload.sub);
  }

  private async findUserByEmailAndPassword(
    email: string,
    password: string,
  ): Promise<User | null> {
    const users = await this.prisma.user.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    const matches: User[] = [];
    for (const user of users) {
      if (await comparePassword(password, user.passwordHash)) {
        matches.push(user);
      }
    }

    if (matches.length === 0) {
      return null;
    }

    // Same email can exist in multiple orgs (e.g. retried Owner signup). Prefer
    // a verified, usable account over an older pending duplicate.
    const verified = matches.find(
      (user) => user.emailVerified && user.status !== UserStatus.DEACTIVATED,
    );
    return verified ?? matches[0];
  }

  private toTokenPayload(user: User): AuthTokenPayload {
    return {
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  private async signPurposeToken(
    userId: string,
    typ: PurposeTokenPayload['typ'],
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, typ },
      {
        secret: this.getAccessSecret(),
        expiresIn: '1d',
      },
    );
  }

  private async verifyPurposeToken(
    rawToken: string,
    typ: PurposeTokenPayload['typ'],
  ): Promise<PurposeTokenPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync<PurposeTokenPayload>(
        rawToken,
        { secret: this.getAccessSecret() },
      );

      if (decoded.typ !== typ) {
        throw invalidPurposeToken();
      }

      return { sub: decoded.sub, typ: decoded.typ };
    } catch {
      throw invalidPurposeToken();
    }
  }

  private async verifyRefreshToken(
    rawRefresh: string,
  ): Promise<AuthTokenPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync<AuthTokenPayload>(
        rawRefresh,
        { secret: this.getRefreshSecret() },
      );
      return {
        sub: decoded.sub,
        role: decoded.role,
        organizationId: decoded.organizationId,
      };
    } catch {
      throw invalidRefresh();
    }
  }

  private buildFrontendLink(path: string, token: string): string {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return `${frontendUrl.replace(/\/$/, '')}${path}?token=${encodeURIComponent(
      token,
    )}`;
  }

  private getAccessSecret(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private getRefreshSecret(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'Incorrect email or password.',
  });
}

function invalidRefresh(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_REFRESH',
    message: 'Invalid refresh token.',
  });
}

function invalidPurposeToken(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_TOKEN',
    message: 'Invalid or expired token.',
  });
}

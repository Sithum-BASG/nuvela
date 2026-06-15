import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AllowWhileMustReset } from '../common/decorators/allow-while-must-reset.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import type {
  AuthenticatedUser,
  CurrentUserResult,
  LoginResult,
} from './auth.service';
import { FirstLoginResetPasswordDto } from './dto/first-login-reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { TokenService } from './token.service';

type RequestWithCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

@ApiTags('auth')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Get('me')
  @AllowWhileMustReset()
  @SkipThrottle()
  @ApiOperation({ summary: 'Return the current authenticated user.' })
  @ApiOkResponse({
    description: 'Current authenticated user.',
    schema: {
      example: {
        id: 'user-id',
        name: 'Maya Fernando',
        email: 'maya@example.com',
        role: 'OWNER',
        organizationId: 'org-id',
        mustResetPassword: false,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired, or stale session cookie.',
  })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserResult> {
    return this.authService.getCurrentUser(user.userId);
  }

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Create an organization and pending Owner user.' })
  @ApiCreatedResponse({
    description: 'Signup created; verification email sent.',
  })
  @ApiBadRequestResponse({ description: 'Invalid input or weak password.' })
  async signup(@Body() dto: SignupDto): Promise<void> {
    await this.authService.signup(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify an Owner signup email.' })
  @ApiOkResponse({ description: 'Email verified.' })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired verification token.',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in and set auth cookies.' })
  @ApiOkResponse({
    description: 'Logged in.',
    schema: {
      example: {
        user: {
          id: 'user-id',
          name: 'Maya Fernando',
          email: 'maya@example.com',
          role: 'OWNER',
          organizationId: 'org-id',
        },
        mustResetPassword: false,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or inactive account.',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult['body']> {
    const result = await this.authService.login(dto);
    this.tokenService.setAuthCookies(res, result.tokens);
    return result.body;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rotate the refresh token and set new auth cookies.',
  })
  @ApiOkResponse({ description: 'Session refreshed.' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired refresh token.',
  })
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const tokens = await this.authService.refresh(req.cookies?.refresh_token);
    this.tokenService.setAuthCookies(res, tokens);
  }

  @Post('logout')
  @HttpCode(200)
  @AllowWhileMustReset()
  @ApiOperation({ summary: 'Log out and clear auth cookies.' })
  @ApiOkResponse({ description: 'Logged out.' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user, req.cookies?.refresh_token);
    this.tokenService.clearAuthCookies(res);
  }

  @Post('first-login/reset-password')
  @HttpCode(200)
  @AllowWhileMustReset()
  @ApiOperation({
    summary: 'Reset an Admin-provisioned first-login password.',
  })
  @ApiOkResponse({ description: 'Password reset.' })
  @ApiBadRequestResponse({
    description: 'Weak password or reset not required.',
  })
  async firstLoginResetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FirstLoginResetPasswordDto,
  ): Promise<void> {
    await this.authService.firstLoginResetPassword(user, dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send a password-reset email if the account exists.',
  })
  @ApiOkResponse({ description: 'Always returned to avoid user enumeration.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset a password from a reset token.' })
  @ApiOkResponse({ description: 'Password reset and sessions revoked.' })
  @ApiBadRequestResponse({ description: 'Weak password.' })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired reset token.',
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }
}

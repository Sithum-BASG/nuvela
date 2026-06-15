import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM_EMAIL = 'onboarding@resend.dev';

@Injectable()
export class MailService {
  constructor(private readonly configService: ConfigService) {}

  async sendVerificationEmail(to: string, link: string): Promise<void> {
    const safeLink = escapeHtml(link);
    await this.sendEmail(
      to,
      'Verify your Nuvela account',
      `<p>Verify your Nuvela account by opening this link:</p><p><a href="${safeLink}">${safeLink}</a></p>`,
    );
  }

  async sendPasswordResetEmail(to: string, link: string): Promise<void> {
    const safeLink = escapeHtml(link);
    await this.sendEmail(
      to,
      'Reset your Nuvela password',
      `<p>Reset your Nuvela password by opening this link:</p><p><a href="${safeLink}">${safeLink}</a></p>`,
    );
  }

  async sendTempPasswordEmail(
    to: string,
    tempPassword: string,
    link: string,
  ): Promise<void> {
    const safePassword = escapeHtml(tempPassword);
    const safeLink = escapeHtml(link);
    await this.sendEmail(
      to,
      'Your Nuvela temporary password',
      `<p>Your Nuvela account is ready.</p><p>Temporary password: <strong>${safePassword}</strong></p><p>Log in here: <a href="${safeLink}">${safeLink}</a></p>`,
    );
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException({
        code: 'EMAIL_SEND_FAILED',
        message: 'Could not send email.',
      });
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

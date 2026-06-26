import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BUCKET = 'attachments';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly base: string;
  private readonly key: string;

  constructor(private readonly configService: ConfigService) {
    this.base = this.configService.getOrThrow<string>('SUPABASE_URL');
    this.key = this.configService.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  async upload(
    objectPath: string,
    bytes: Buffer,
    mimeType: string,
  ): Promise<void> {
    const res = await fetch(
      `${this.base}/storage/v1/object/${BUCKET}/${objectPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.key}`,
          'Content-Type': mimeType,
          'x-upsert': 'false',
        },
        body: new Uint8Array(bytes),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Storage upload failed (${res.status}): ${body}`);
      throw new InternalServerErrorException({
        code: 'UPLOAD_FAILED',
        message: 'File upload failed.',
      });
    }
  }

  async createSignedUrl(
    objectPath: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const res = await fetch(
      `${this.base}/storage/v1/object/sign/${BUCKET}/${objectPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Signed URL failed (${res.status}): ${body}`);
      throw new InternalServerErrorException({
        code: 'SIGNED_URL_FAILED',
        message: 'Could not create download URL.',
      });
    }

    const data = (await res.json()) as { signedURL: string };
    return this.toStorageUrl(data.signedURL);
  }

  async remove(objectPath: string): Promise<void> {
    const res = await fetch(
      `${this.base}/storage/v1/object/${BUCKET}/${objectPath}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.key}` },
      },
    );

    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      this.logger.error(`Storage remove failed (${res.status}): ${body}`);
    }
  }

  private toStorageUrl(signedPath: string): string {
    if (signedPath.startsWith('http://') || signedPath.startsWith('https://')) {
      return signedPath;
    }

    const path = signedPath.startsWith('/storage/v1')
      ? signedPath
      : `/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`;
    return new URL(path, this.base).toString();
  }
}

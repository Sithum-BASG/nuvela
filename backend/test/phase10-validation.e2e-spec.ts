import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';

type ErrorBody = {
  statusCode: number;
  code: string;
  message: string | string[];
};

describe('Phase 10 validation (e2e)', () => {
  let app: INestApplication;

  const mailServiceMock = {
    sendVerificationEmail: jest.fn<Promise<void>, [string, string]>(),
    sendPasswordResetEmail: jest.fn<Promise<void>, [string, string]>(),
    sendTempPasswordEmail: jest.fn<Promise<void>, [string, string, string]>(),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.RESEND_API_KEY = 'test-resend-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns structured validation errors for invalid signup payloads', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: '',
        email: 'not-an-email',
        password: 'short',
        orgName: '',
      })
      .expect(400);

    const body = responseBody<ErrorBody>(response);
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'HTTP_EXCEPTION',
    });
    expect(Array.isArray(body.message)).toBe(true);
    expect(body.message.length).toBeGreaterThan(0);
  });

  it('returns structured errors for invalid login payloads', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'bad', password: '' })
      .expect(400);

    const body = responseBody<ErrorBody>(response);
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'HTTP_EXCEPTION',
    });
    expect(Array.isArray(body.message)).toBe(true);
  });
});

function responseBody<T>(response: SupertestResponse): T {
  return response.body as T;
}

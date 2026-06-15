import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  // CORS locked to the frontend origin WITH credentials (for HTTP-only cookies
  // in Phase 3). Never use '*' with credentials. Per TRD auth/CORS section.
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  app.enableCors({ origin: frontendUrl, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Local default 3001 so it doesn't clash with the frontend's 3000.
  // Render injects PORT in production.
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();

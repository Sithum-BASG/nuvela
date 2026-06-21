import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nuvela API')
    .setDescription(
      'REST API for the Nuvela multi-tenant Kanban workspace. Auth uses HTTP-only cookies (`access_token`, `refresh_token`).',
    )
    .setVersion('1.0')
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
    })
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  // Local default 3001 so it doesn't clash with the frontend's 3000.
  // Render injects PORT in production.
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();

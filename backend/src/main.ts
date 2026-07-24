import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true exposes req.rawBody to controllers — needed for the
  // WhatsApp webhook (Meta signs the raw bytes with X-Hub-Signature-256).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Default Express body limit is 100kb — too small for a branding save, which
  // carries the logo inline as a base64 data URL, and for large brief edits.
  // Raise it while keeping rawBody intact (Meta signs the raw webhook bytes).
  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('urlencoded', { limit: '8mb', extended: true });

  const config = app.get(ConfigService);

  // Behind Railway/nginx the client IP arrives in X-Forwarded-For. Trust the
  // proxy so req.ip is the real caller — the rate limiter keys on it.
  app.set('trust proxy', 1);

  app.setGlobalPrefix(config.get<string>('API_PREFIX', 'api'));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // Auth is via bearer tokens (Authorization header), not cookies, so we do
  // NOT enable credentials — a '*'+credentials combo is contradictory and
  // browsers reject it. Set an explicit CORS_ORIGIN allowlist in prod.
  const corsOrigin = config.get<string>('CORS_ORIGIN', '*');
  app.enableCors({
    origin:
      corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: false,
  });
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  console.log(
    `API listening on http://0.0.0.0:${port}/${config.get<string>('API_PREFIX', 'api')}`,
  );
}
void bootstrap();

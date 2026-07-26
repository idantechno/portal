import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { Business } from './businesses/business.entity';
import { WhatsappConnectionsService } from './whatsapp/whatsapp-connections.service';

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

  // One-shot operator bootstrap: if DIALOG360_BOOTSTRAP_KEY is present, attach
  // the 360dialog number to the (single) business and log the webhook URL. Lets
  // us connect without a console/curl; the operator removes the var afterwards.
  await bootstrap360dialog(app);
}

async function bootstrap360dialog(app: NestExpressApplication): Promise<void> {
  const log = new Logger('Dialog360Bootstrap');
  const key = process.env.DIALOG360_BOOTSTRAP_KEY;
  log.log(`bootstrap check: keyPresent=${Boolean(key)}`);
  if (!key) return;
  try {
    const ds = app.get(DataSource);
    const conns = app.get(WhatsappConnectionsService);
    const businesses = await ds.getRepository(Business).find();
    log.log(`businesses found: ${businesses.length}`);
    const target =
      businesses.find((b) => /portal\s*studio/i.test(b.name ?? '')) ??
      businesses[0];
    if (!target) {
      log.error('No business found to attach the 360dialog number to.');
      return;
    }
    await conns.connect360dialog({
      businessId: target.id,
      apiKey: key,
      wabaId: '1360655686138700',
      displayPhoneNumber: '+972 51-522-3921',
    });
    log.log(`Connected 360dialog to business "${target.name}" (${target.id}).`);
    log.log(`WEBHOOK URL -> ${conns.webhookUrl(target.id)}`);
    log.warn(
      'Bootstrap done — now REMOVE the DIALOG360_BOOTSTRAP_KEY env var.',
    );
  } catch (err) {
    log.error(`360dialog bootstrap failed: ${(err as Error).message}`);
  }
}

void bootstrap();

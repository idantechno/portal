import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { MorningWebhookService } from './morning-webhook.service';

/**
 * Inbound payment webhook from morning (חשבונית ירוקה) / GROW.
 * Actual URL is `/api/webhooks/morning` (global `api` prefix) — paste that into
 * the Webhooks tab of the morning dashboard.
 *
 * Public + un-throttled like the WhatsApp webhook: authenticity is the
 * `X-Data-Signature` HMAC, not a session. We always answer 2xx once the body
 * parses so morning stops retrying; whether we could act on it is logged.
 */
@SkipThrottle()
@Controller('webhooks/morning')
export class MorningWebhookController {
  private readonly log = new Logger(MorningWebhookController.name);

  constructor(private readonly morning: MorningWebhookService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post()
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-data-signature') signature: string | undefined,
  ): Promise<{ ok: true }> {
    const raw = req.rawBody;
    if (!raw) throw new BadRequestException('Missing raw body');

    const signatureOk = this.morning.verifySignature(raw, signature);
    if (signatureOk === false) {
      // A secret is configured but the digest didn't match — reject. Log only
      // non-sensitive facts, never the expected HMAC.
      this.log.warn(
        `[morning] bad signature (rawLen=${raw.length} header=${
          signature ? 'present' : 'MISSING'
        })`,
      );
      return { ok: true };
    }
    if (signatureOk === null) {
      // No MORNING_WEBHOOK_SECRET set yet — can't verify. Process anyway so
      // setup isn't blocked, but make the gap loud in the logs.
      this.log.warn(
        '[morning] MORNING_WEBHOOK_SECRET not configured — processing unverified webhook',
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid JSON');
    }

    await this.morning.handle(payload);
    return { ok: true };
  }
}

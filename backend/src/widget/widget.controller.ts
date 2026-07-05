import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { WidgetService } from './widget.service';
import { SendWidgetMessageDto } from './dto/send-widget-message.dto';

/**
 * Unauthenticated endpoints called by the embeddable web widget.
 * Security is gated by `publicKey` (per-business) and `sessionToken` (per-
 * customer session). See WidgetService docs for the model.
 *
 * TODO(prod): Honor Business.widgetAllowedOrigins for CORS / Origin header
 *             enforcement before opening this beyond first-party hosting.
 */
@Public()
@Controller('widget')
export class WidgetController {
  constructor(private readonly widget: WidgetService) {}

  // New anonymous sessions are cheap to create but each one can drive agent
  // runs — cap fresh sessions per IP so a bot can't spin up thousands.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post(':publicKey/session')
  createSession(@Param('publicKey') publicKey: string) {
    return this.widget.createSession(publicKey);
  }

  @Get('session/:sessionToken/messages')
  async list(
    @Param('sessionToken') sessionToken: string,
    @Query('since') sinceIso?: string,
  ) {
    const since = sinceIso ? new Date(sinceIso) : undefined;
    return this.widget.listMessages(sessionToken, { since });
  }

  // Each inbound message triggers a full Claude agent run on our Anthropic key.
  // This is the primary cost-abuse vector: 20 messages / minute / IP is plenty
  // for a real chat and caps the spend a scripted flood can inflict.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('session/:sessionToken/messages')
  send(
    @Param('sessionToken') sessionToken: string,
    @Body() dto: SendWidgetMessageDto,
  ) {
    return this.widget.sendCustomerMessage(sessionToken, dto.content);
  }
}

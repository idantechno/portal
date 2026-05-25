import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
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

  @Post('session/:sessionToken/messages')
  send(
    @Param('sessionToken') sessionToken: string,
    @Body() dto: SendWidgetMessageDto,
  ) {
    return this.widget.sendCustomerMessage(sessionToken, dto.content);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';
import { SubscribePushDto, UnsubscribePushDto } from './dto/subscribe-push.dto';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Public VAPID key the browser needs to build a push subscription. */
  @Get('push/vapid-key')
  vapidKey() {
    return { publicKey: this.notifications.vapidPublicKey() };
  }

  @Post('push/subscribe')
  async subscribePush(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscribePushDto,
  ) {
    await this.notifications.subscribePush(businessId, user.id, {
      endpoint: dto.endpoint,
      keys: dto.keys,
      userAgent: dto.userAgent ?? null,
    });
    return { ok: true };
  }

  @Post('push/unsubscribe')
  async unsubscribePush(@Body() dto: UnsubscribePushDto) {
    await this.notifications.unsubscribePush(dto.endpoint);
    return { ok: true };
  }

  @Get()
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.list(businessId, {
      unreadOnly: unread === 'true',
    });
  }

  @Get('unread-count')
  async unreadCount(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return { count: await this.notifications.unreadCount(businessId) };
  }

  @Post(':id/read')
  markRead(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(businessId, id);
  }

  @Post('read-all')
  markAllRead(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.notifications.markAllRead(businessId);
  }
}

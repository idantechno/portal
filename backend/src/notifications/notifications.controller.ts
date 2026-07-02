import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

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

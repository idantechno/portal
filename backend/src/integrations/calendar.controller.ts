import {
  BadRequestException,
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
import { CalendarService } from './calendar.service';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('status')
  async status(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return { connected: await this.calendar.isConnected(businessId) };
  }

  @Get('google-events')
  async events(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!(await this.calendar.isConnected(businessId))) return [];
    if (!from || !to) throw new BadRequestException('from and to are required');
    return this.calendar.listEvents(businessId, from, to);
  }

  @Post('google-events')
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: { title?: string; start?: string; end?: string },
  ) {
    if (!body?.title || !body?.start) {
      throw new BadRequestException('title and start are required');
    }
    return this.calendar.createEvent(businessId, {
      title: body.title,
      start: body.start,
      end: body.end,
    });
  }
}

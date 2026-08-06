import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { ScheduleService } from './schedule.service';

/**
 * Business-facing read of the unified timeline. Powers the calendar's "היום"
 * (daily review) tab. Any member may read; scoped by BusinessScopeGuard.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('agenda')
  agenda(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (
      !fromDate ||
      !toDate ||
      isNaN(fromDate.getTime()) ||
      isNaN(toDate.getTime())
    ) {
      throw new BadRequestException('from and to (ISO) are required');
    }
    return this.schedule.agenda(businessId, fromDate, toDate);
  }
}

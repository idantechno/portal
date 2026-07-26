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
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistDto, ListWaitlistQueryDto } from './dto/waitlist.dto';
import { parseIsraelDate } from '../common/time/israel-time';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Get()
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListWaitlistQueryDto,
  ) {
    return this.waitlist.list(businessId, { status: query.status });
  }

  @Post()
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateWaitlistDto,
  ) {
    return this.waitlist.join({
      businessId,
      service: dto.service,
      customerContactId: dto.customerContactId ?? null,
      customerName: dto.customerName ?? null,
      phone: dto.phone ?? null,
      preferredFrom: dto.preferredFrom
        ? parseIsraelDate(dto.preferredFrom)
        : null,
      preferredTo: dto.preferredTo ? parseIsraelDate(dto.preferredTo) : null,
      notes: dto.notes ?? null,
    });
  }

  @Post(':entryId/cancel')
  cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ) {
    return this.waitlist.cancel(businessId, entryId);
  }
}

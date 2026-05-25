import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { LeadsService } from './leads.service';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.leads.list(businessId);
  }
}

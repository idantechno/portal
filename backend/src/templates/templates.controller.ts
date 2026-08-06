import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { TemplatesService } from './templates.service';

/**
 * Business-facing: the template catalog for this business, each entry flagged
 * `entitled` — drives the "טמפלייטים" list on the Chat Agent page. Any member
 * may read it.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.templates.listForBusiness(businessId);
  }
}

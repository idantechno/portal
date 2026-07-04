import { Controller, Get, UseGuards } from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import {
  CurrentBusiness,
  BusinessScopeContext,
} from '../businesses/decorators/current-business.decorator';
import { OverviewService, OverviewExtras } from './overview.service';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  /** Live home-dashboard widgets: daily tip, a field news item, weather. */
  @Get('overview')
  get(@CurrentBusiness() scope: BusinessScopeContext): Promise<OverviewExtras> {
    return this.overview.get(scope.business);
  }
}

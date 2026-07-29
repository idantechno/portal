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
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { MailAgentService } from './mail-agent.service';
import { MailItemStatus } from './mail-item.entity';

const STATUSES: MailItemStatus[] = ['pending', 'approved', 'dismissed'];

@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('email')
@Controller('businesses/:businessId')
export class MailAgentController {
  constructor(private readonly mail: MailAgentService) {}

  @Get('mail-items')
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('status') status?: string,
  ) {
    const filter = STATUSES.includes(status as MailItemStatus)
      ? (status as MailItemStatus)
      : undefined;
    return this.mail.list(businessId, filter);
  }

  @Post('mail-items/:id/approve')
  approve(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mail.approve(businessId, id);
  }

  @Post('mail-items/:id/dismiss')
  dismiss(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mail.dismiss(businessId, id);
  }
}

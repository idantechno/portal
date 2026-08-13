import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { AccountantService } from './accountant.service';
import { SendAccountantDto } from './dto/send-accountant.dto';

/**
 * The "send financial documents to the accountant" action. The recipient is
 * never in the request — it's the locked accountant contact on the business —
 * so this endpoint can only ever deliver to that address.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/accountant')
export class AccountantController {
  constructor(private readonly accountant: AccountantService) {}

  @Get('status')
  status(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.accountant.status(businessId);
  }

  @Post('send')
  send(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: SendAccountantDto,
  ) {
    return this.accountant.sendToAccountant(businessId, {
      year: dto.year,
      month: dto.month,
    });
  }
}

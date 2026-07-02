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
import { GreenInvoiceService } from './green-invoice.service';
import { ConnectGreenInvoiceDto } from './dto/connect-green-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/green-invoice')
export class GreenInvoiceController {
  constructor(private readonly greenInvoice: GreenInvoiceService) {}

  @Get('status')
  status(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.greenInvoice.status(businessId);
  }

  @Post('connect')
  connect(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: ConnectGreenInvoiceDto,
  ) {
    return this.greenInvoice.connect(businessId, dto);
  }

  @Post('disconnect')
  async disconnect(@Param('businessId', ParseUUIDPipe) businessId: string) {
    await this.greenInvoice.disconnect(businessId);
    return { ok: true };
  }

  @Post('issue')
  issue(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: IssueInvoiceDto,
  ) {
    return this.greenInvoice.issueInvoice(businessId, dto);
  }
}

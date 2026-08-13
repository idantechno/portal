import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { CrmService } from './crm.service';
import { UpsertCrmDto } from './dto/upsert-crm.dto';

/**
 * Operator/owner configuration for a business's external CRM destination —
 * where captured leads and booked appointments are pushed. The signing secret
 * is write-only (never returned); reads expose only whether one is set.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/crm-connection')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get()
  view(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.crm.view(businessId);
  }

  @Put()
  upsert(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: UpsertCrmDto,
  ) {
    return this.crm.upsert(businessId, dto);
  }

  @Delete()
  async remove(@Param('businessId', ParseUUIDPipe) businessId: string) {
    await this.crm.remove(businessId);
    return { ok: true };
  }

  @Post('test')
  async test(@Param('businessId', ParseUUIDPipe) businessId: string) {
    try {
      await this.crm.test(businessId);
      return { ok: true };
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}

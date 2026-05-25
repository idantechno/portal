import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { BusinessOwnerGuard } from '../businesses/guards/business-owner.guard';
import { WhatsappConnectionsService } from './whatsapp-connections.service';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/channels/whatsapp')
export class WhatsappConnectionsController {
  constructor(private readonly conns: WhatsappConnectionsService) {}

  @Get()
  async get(@Param('businessId', ParseUUIDPipe) businessId: string) {
    const conn = await this.conns.findByBusinessId(businessId);
    return conn ? this.conns.toPublic(conn) : null;
  }

  @UseGuards(BusinessOwnerGuard)
  @Delete()
  async delete(@Param('businessId', ParseUUIDPipe) businessId: string) {
    await this.conns.delete(businessId);
    return { ok: true };
  }
}

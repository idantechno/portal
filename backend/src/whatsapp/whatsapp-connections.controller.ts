import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { BusinessRoleGuard } from '../businesses/guards/business-role.guard';
import { MinBusinessRole } from '../businesses/decorators/business-roles.decorator';
import { BusinessRole } from '../common/enums/business-role.enum';
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

  @UseGuards(BusinessRoleGuard)
  @MinBusinessRole(BusinessRole.Admin)
  @Delete()
  async delete(@Param('businessId', ParseUUIDPipe) businessId: string) {
    await this.conns.delete(businessId);
    return { ok: true };
  }
}

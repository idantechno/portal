import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { BusinessRoleGuard } from '../businesses/guards/business-role.guard';
import { MinBusinessRole } from '../businesses/decorators/business-roles.decorator';
import { BusinessRole } from '../common/enums/business-role.enum';
import { WhatsappConnectionsService } from './whatsapp-connections.service';
import { Connect360dialogDto } from './dto/connect-360dialog.dto';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/channels/whatsapp')
export class WhatsappConnectionsController {
  constructor(private readonly conns: WhatsappConnectionsService) {}

  @Get()
  async get(@Param('businessId', ParseUUIDPipe) businessId: string) {
    const conn = await this.conns.findByBusinessId(businessId);
    return conn ? this.conns.toPublic(conn) : null;
  }

  /**
   * Bridge connect: paste a 360dialog API key. Validates it, points the webhook
   * back at us, and stores the connection. Admin-only — the operator runs this
   * during the guided setup so the customer never handles the key.
   */
  @UseGuards(BusinessRoleGuard)
  @MinBusinessRole(BusinessRole.Admin)
  @Post('connect-360dialog')
  async connect360dialog(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: Connect360dialogDto,
  ) {
    const conn = await this.conns.connectWith360dialogApiKey(
      businessId,
      dto.apiKey.trim(),
      dto.displayPhoneNumber?.trim() || null,
    );
    return this.conns.toPublic(conn);
  }

  @UseGuards(BusinessRoleGuard)
  @MinBusinessRole(BusinessRole.Admin)
  @Delete()
  async delete(@Param('businessId', ParseUUIDPipe) businessId: string) {
    await this.conns.delete(businessId);
    return { ok: true };
  }
}

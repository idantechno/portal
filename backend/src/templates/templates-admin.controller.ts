import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditService } from '../audit/audit.service';
import { TemplatesService } from './templates.service';
import { isTemplateName } from './template-catalog';
import { SetTemplateAccessDto } from './dto/set-template-access.dto';

/**
 * Admin-facing template entitlements — mirror of AgentsAdminController. Staff
 * may read per-business state; only super admins grant/revoke.
 */
@Roles(UserRole.SuperAdmin, UserRole.Support)
@Controller('admin/businesses/:businessId/templates')
export class TemplatesAdminController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.templates.accessForBusiness(businessId);
  }

  @Roles(UserRole.SuperAdmin)
  @Put(':templateName')
  async setAccess(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('templateName') templateName: string,
    @Body() dto: SetTemplateAccessDto,
    @Ip() ip: string,
  ) {
    if (!isTemplateName(templateName)) {
      throw new BadRequestException(`Unknown template: ${templateName}`);
    }
    const row = await this.templates.setAccess(
      businessId,
      templateName,
      dto.enabled,
      actor.id,
    );
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: dto.enabled ? 'template.granted' : 'template.revoked',
      businessId,
      targetType: 'template',
      targetId: templateName,
      metadata: { enabled: dto.enabled },
      ip,
    });
    return row;
  }

  @Roles(UserRole.SuperAdmin)
  @Delete(':templateName')
  async resetAccess(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('templateName') templateName: string,
    @Ip() ip: string,
  ) {
    if (!isTemplateName(templateName)) {
      throw new BadRequestException(`Unknown template: ${templateName}`);
    }
    const removed = await this.templates.resetAccess(businessId, templateName);
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'template.reset',
      businessId,
      targetType: 'template',
      targetId: templateName,
      metadata: { removed },
      ip,
    });
    return { ok: true, removed };
  }
}

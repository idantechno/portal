import {
  Controller,
  Delete,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { BusinessRoleGuard } from '../businesses/guards/business-role.guard';
import { MinBusinessRole } from '../businesses/decorators/business-roles.decorator';
import { BusinessRole } from '../common/enums/business-role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { ContactErasureService } from './contact-erasure.service';

/**
 * "Right to be forgotten" endpoints — permanently erase one end-customer's
 * personal data from a business. Destructive, so restricted to business Admins
 * and up (and platform staff), and every erasure is written to the audit log.
 */
@UseGuards(BusinessScopeGuard, BusinessRoleGuard)
@MinBusinessRole(BusinessRole.Admin)
@Controller('businesses/:businessId/privacy')
export class DataPrivacyController {
  constructor(
    private readonly erasure: ContactErasureService,
    private readonly audit: AuditService,
  ) {}

  @Delete('contacts/:contactId')
  @HttpCode(204)
  async eraseContact(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Ip() ip: string,
  ): Promise<void> {
    await this.erasure.eraseContact(businessId, contactId);
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'contact.erased',
      businessId,
      targetType: 'contact',
      targetId: contactId,
      ip,
    });
  }

  @Delete('leads/:leadId')
  @HttpCode(204)
  async eraseLead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Ip() ip: string,
  ): Promise<void> {
    await this.erasure.eraseLead(businessId, leadId);
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'lead.erased',
      businessId,
      targetType: 'lead',
      targetId: leadId,
      ip,
    });
  }
}

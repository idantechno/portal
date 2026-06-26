import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { BusinessRole } from '../common/enums/business-role.enum';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import {
  CurrentBusiness,
  BusinessScopeContext,
} from './decorators/current-business.decorator';
import { BusinessScopeGuard } from './guards/business-scope.guard';
import { BusinessRoleGuard } from './guards/business-role.guard';
import { MinBusinessRole } from './decorators/business-roles.decorator';

@Controller('businesses')
export class BusinessesController {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.businesses.listForUser(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBusinessDto,
  ) {
    const business = await this.businesses.create(user.id, dto);
    const fresh = await this.users.findById(user.id);
    if (fresh && !fresh.defaultBusinessId) {
      await this.users.setDefaultBusiness(user.id, business.id);
    }
    return business;
  }

  @UseGuards(BusinessScopeGuard)
  @Get(':businessId')
  get(@CurrentBusiness() scope: BusinessScopeContext) {
    // Expose the caller's own role so the frontend can gate navigation, plus a
    // flag when access is via platform-staff privilege (impersonation banner).
    return {
      ...scope.business,
      myRole: scope.membership?.role ?? null,
      viaPlatformStaff: scope.viaPlatformStaff,
    };
  }

  @UseGuards(BusinessScopeGuard, BusinessRoleGuard)
  @MinBusinessRole(BusinessRole.Admin)
  @Patch(':businessId')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBusiness() scope: BusinessScopeContext,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: UpdateBusinessDto,
    @Ip() ip: string,
  ) {
    const result = await this.businesses.update(businessId, dto);
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'business.updated',
      businessId,
      targetType: 'business',
      targetId: businessId,
      metadata: {
        fields: Object.keys(dto),
        viaPlatformStaff: scope.viaPlatformStaff,
      },
      ip,
    });
    return result;
  }

  @UseGuards(BusinessScopeGuard)
  @Get(':businessId/members')
  listMembers(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.businesses.listMembersWithUsers(businessId);
  }

  @UseGuards(BusinessScopeGuard, BusinessRoleGuard)
  @MinBusinessRole(BusinessRole.Admin)
  @Post(':businessId/members')
  async addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: AddMemberDto,
    @Ip() ip: string,
  ) {
    const member = await this.businesses.addMember(businessId, dto);
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'member.added',
      businessId,
      targetType: 'user',
      targetId: member.userId,
      metadata: { email: dto.email, role: dto.role },
      ip,
    });
    return member;
  }

  @UseGuards(BusinessScopeGuard, BusinessRoleGuard)
  @MinBusinessRole(BusinessRole.Admin)
  @Patch(':businessId/members/:userId')
  async updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Ip() ip: string,
  ) {
    const member = await this.businesses.updateMemberRole(
      businessId,
      userId,
      dto.role,
    );
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'member.role_changed',
      businessId,
      targetType: 'user',
      targetId: userId,
      metadata: { role: dto.role },
      ip,
    });
    return member;
  }

  @UseGuards(BusinessScopeGuard, BusinessRoleGuard)
  @MinBusinessRole(BusinessRole.Admin)
  @Delete(':businessId/members/:userId')
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Ip() ip: string,
  ) {
    await this.businesses.removeMember(businessId, userId);
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'member.removed',
      businessId,
      targetType: 'user',
      targetId: userId,
      ip,
    });
    return { ok: true };
  }
}

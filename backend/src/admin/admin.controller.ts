import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '../common/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { AdminService } from './admin.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ListAuditQueryDto } from './dto/list-audit.dto';
import { CreateClientDto } from './dto/create-client.dto';

/**
 * Cross-tenant admin surface. The class-level @Roles lets platform staff
 * (super admin + support) read; mutating routes narrow to super admin only.
 * Enforcement comes from the globally-registered RolesGuard reading this
 * metadata (no per-controller @UseGuards needed).
 */
@Roles(UserRole.SuperAdmin, UserRole.Support)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('agents')
  agentCatalog() {
    return this.admin.agentCatalog();
  }

  @Get('businesses')
  listBusinesses(@Query('q') q?: string) {
    return this.admin.listBusinesses(q);
  }

  @Get('businesses/:businessId')
  businessDetail(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.admin.businessDetail(businessId);
  }

  /** Onboard a client: creates the business + owner account + agent grants. */
  @Roles(UserRole.SuperAdmin)
  @Post('businesses')
  async createClient(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateClientDto,
    @Ip() ip: string,
  ) {
    const result = await this.admin.createClient(actor.id, dto);
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'client.created',
      businessId: result.business.id,
      targetType: 'business',
      targetId: result.business.id,
      metadata: { ownerEmail: result.owner.email, agents: dto.agentKeys },
      ip,
    });
    return result;
  }

  /**
   * Logged "enter business" action — the frontend calls this right before a
   * staff member opens a tenant they don't belong to, so every remote-management
   * session leaves an audit trail.
   */
  @Post('businesses/:businessId/access')
  async access(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Ip() ip: string,
  ) {
    const detail = await this.admin.businessDetail(businessId);
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'business.access',
      businessId,
      targetType: 'business',
      targetId: businessId,
      ip,
    });
    return detail;
  }

  @Roles(UserRole.SuperAdmin)
  @Patch('businesses/:businessId/status')
  async setBusinessStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: UpdateStatusDto,
    @Ip() ip: string,
  ) {
    const result = await this.admin.setBusinessStatus(businessId, dto.status);
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'business.status_changed',
      businessId,
      targetType: 'business',
      targetId: businessId,
      metadata: { status: dto.status },
      ip,
    });
    return result;
  }

  @Get('users')
  listUsers(@Query('q') q?: string) {
    return this.admin.listUsers(q);
  }

  @Roles(UserRole.SuperAdmin)
  @Patch('users/:userId/role')
  async setUserRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserRoleDto,
    @Ip() ip: string,
  ) {
    if (userId === actor.id) {
      throw new BadRequestException('You cannot change your own platform role');
    }
    await this.users.setRole(userId, dto.role);
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'user.role_changed',
      targetType: 'user',
      targetId: userId,
      metadata: { role: dto.role },
      ip,
    });
    return { ok: true };
  }

  @Roles(UserRole.SuperAdmin)
  @Patch('users/:userId/status')
  async setUserStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateStatusDto,
    @Ip() ip: string,
  ) {
    if (userId === actor.id) {
      throw new BadRequestException('You cannot suspend your own account');
    }
    await this.users.setStatus(userId, dto.status);
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'user.status_changed',
      targetType: 'user',
      targetId: userId,
      metadata: { status: dto.status },
      ip,
    });
    return { ok: true };
  }

  @Roles(UserRole.SuperAdmin)
  @Post('users/:userId/reset-password')
  async resetUserPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Ip() ip: string,
  ) {
    const result = await this.admin.resetUserPassword(userId);
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'user.password_reset',
      targetType: 'user',
      targetId: userId,
      ip,
    });
    return result;
  }

  @Get('audit')
  listAudit(@Query() query: ListAuditQueryDto) {
    return this.audit.list(query);
  }
}

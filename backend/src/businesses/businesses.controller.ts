import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from '../users/users.service';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { AddMemberDto } from './dto/add-member.dto';
import {
  CurrentBusiness,
  BusinessScopeContext,
} from './decorators/current-business.decorator';
import { BusinessScopeGuard } from './guards/business-scope.guard';
import { BusinessOwnerGuard } from './guards/business-owner.guard';

@Controller('businesses')
export class BusinessesController {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly users: UsersService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.businesses.listForUser(user.id, user.role);
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
    return scope.business;
  }

  @UseGuards(BusinessScopeGuard, BusinessOwnerGuard)
  @Patch(':businessId')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businesses.update(businessId, dto);
  }

  @UseGuards(BusinessScopeGuard)
  @Get(':businessId/members')
  listMembers(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.businesses.listMembers(businessId);
  }

  @UseGuards(BusinessScopeGuard, BusinessOwnerGuard)
  @Post(':businessId/members')
  addMember(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.businesses.addMember(businessId, dto);
  }

  @UseGuards(BusinessScopeGuard, BusinessOwnerGuard)
  @Delete(':businessId/members/:userId')
  async removeMember(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.businesses.removeMember(businessId, userId);
    return { ok: true };
  }
}

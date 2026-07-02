import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '../common/enums/user-role.enum';
import { AutomationsService } from './automations.service';
import { UpsertAutomationDto } from './dto/upsert-automation.dto';
import { SetEnabledDto } from './dto/set-enabled.dto';
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_TRIGGERS,
} from './automation.constants';

/**
 * Automations are OPERATOR-DEFINED: only platform staff (the operator) may
 * create/edit/delete/test rules. The business owner can only view them and
 * toggle them on/off (the `:id/enabled` route, open to any business member).
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/automations')
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  /** Static catalog of triggers + action types for building rules in the UI. */
  @Get('catalog')
  catalog() {
    return {
      triggers: AUTOMATION_TRIGGERS,
      actionTypes: AUTOMATION_ACTION_TYPES,
    };
  }

  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.automations.list(businessId);
  }

  /** Owner-allowed: flip a rule on/off. */
  @Patch(':id/enabled')
  setEnabled(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetEnabledDto,
  ) {
    return this.automations.setEnabled(businessId, id, dto.enabled);
  }

  @Roles(UserRole.SuperAdmin, UserRole.Support)
  @Post()
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: UpsertAutomationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.automations.create(businessId, dto, user.id);
  }

  @Roles(UserRole.SuperAdmin, UserRole.Support)
  @Put(':id')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertAutomationDto,
  ) {
    return this.automations.update(businessId, id, dto);
  }

  @Roles(UserRole.SuperAdmin, UserRole.Support)
  @Post(':id/test')
  test(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.automations.test(businessId, id);
  }

  @Roles(UserRole.SuperAdmin, UserRole.Support)
  @Delete(':id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.automations.remove(businessId, id);
    return { ok: true };
  }
}

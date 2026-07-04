import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import {
  CurrentBusiness,
  BusinessScopeContext,
} from '../businesses/decorators/current-business.decorator';
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { BillingService } from '../billing/billing.service';
import { RemindersAgentService } from './reminders-agent.service';
import { RemindersChatDto } from './dto/reminders-chat.dto';
import {
  computeRemindersEntitlement,
  RemindersEntitlement,
} from './reminders-entitlement';

@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('reminders')
@Controller('businesses/:businessId')
export class RemindersAgentController {
  constructor(
    private readonly agent: RemindersAgentService,
    private readonly billing: BillingService,
  ) {}

  /** Trial / lock status for the reminders agent (drives the frontend UI). */
  @Get('agents/reminders/entitlement')
  async entitlement(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentBusiness() scope: BusinessScopeContext,
  ): Promise<RemindersEntitlement & { staffBypass: boolean }> {
    const sub = await this.billing.getSubscription(businessId);
    const ent = computeRemindersEntitlement(
      scope.business.createdAt,
      sub.planCode,
      sub.status,
    );
    return { ...ent, staffBypass: scope.viaPlatformStaff };
  }

  @Post('agents/reminders/chat')
  async chat(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: RemindersChatDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBusiness() scope: BusinessScopeContext,
  ) {
    // Enforce the trial/paywall — platform staff always pass.
    if (!scope.viaPlatformStaff) {
      const sub = await this.billing.getSubscription(businessId);
      const ent = computeRemindersEntitlement(
        scope.business.createdAt,
        sub.planCode,
        sub.status,
      );
      if (ent.locked) {
        throw new ForbiddenException('REMINDERS_TRIAL_ENDED');
      }
    }
    return this.agent.chat({
      businessId,
      userId: user.id,
      history: dto.history,
    });
  }
}

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { isPlatformStaff } from '../common/enums/user-role.enum';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { SetPlanDto } from './dto/set-plan.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly stripe: StripeService,
  ) {}

  /** Start a GROW checkout for a paid plan; returns the hosted payment URL. */
  @Post('checkout')
  checkout(@Body() dto: SetPlanDto) {
    return this.billing.growCheckout(dto.planCode);
  }

  /** Confirm a returned Checkout session and activate the subscription. */
  @Post('checkout/confirm')
  confirmCheckout(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: ConfirmCheckoutDto,
  ) {
    return this.stripe.confirmCheckout(businessId, dto.sessionId);
  }

  @Get('plans')
  plans() {
    return {
      plans: this.billing.plans(),
      providers: this.billing.providerStatus(),
    };
  }

  @Get('subscription')
  subscription(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.billing.getSubscription(businessId);
  }

  /**
   * The capabilities the business's plan currently unlocks. The frontend uses
   * this to hide features the tier doesn't include (e.g. the manual calendar or
   * the Google connect button). UI hiding is not authoritative — the routes
   * themselves are still guarded with @RequireCapability.
   */
  @Get('capabilities')
  async capabilities(@Param('businessId', ParseUUIDPipe) businessId: string) {
    const caps = await this.billing.getCapabilities(businessId);
    return { capabilities: [...caps] };
  }

  /**
   * Manually set a plan WITHOUT payment. This bypasses Stripe checkout, so it
   * is restricted to platform staff (the operator) — a business member must go
   * through /checkout. Otherwise any member could self-upgrade to a paid plan
   * for free and defeat every paywall (reminders trial, entitlements).
   */
  @Put('subscription')
  setPlan(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: SetPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!isPlatformStaff(user.role)) {
      throw new ForbiddenException(
        'PLAN_CHANGE_REQUIRES_CHECKOUT: use the checkout flow to change plans',
      );
    }
    return this.billing.setPlan(businessId, dto.planCode);
  }

  @Get('invoices')
  invoices(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.billing.listInvoices(businessId);
  }

  @Post('invoices')
  createInvoice(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.billing.createInvoice(businessId, dto);
  }

  @Post('invoices/:id/paid')
  markPaid(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.markInvoicePaid(businessId, id);
  }
}

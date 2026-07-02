import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { getPlan } from './billing-plans';

interface StripeCheckoutSession {
  id: string;
  url?: string;
  payment_status?: string;
  client_reference_id?: string;
  metadata?: { planCode?: string };
  subscription?: {
    id: string;
    current_period_end?: number;
  } | null;
}

/**
 * Stripe Checkout for subscription billing — implemented over the REST API
 * (no SDK dependency). `createCheckoutSession` returns a hosted payment URL;
 * `confirmCheckout` is called when the customer returns and activates the
 * subscription if payment succeeded. Recurring renewals/cancellations will be
 * handled by a webhook in a later pass.
 */
@Injectable()
export class StripeService {
  private readonly log = new Logger(StripeService.name);
  private readonly base = 'https://api.stripe.com/v1';

  constructor(
    private readonly config: ConfigService,
    private readonly billing: BillingService,
  ) {}

  private secret(): string {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new BadRequestException('STRIPE_NOT_CONFIGURED');
    return key;
  }

  private frontendUrl(): string {
    return this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:5173';
  }

  /** Stripe expects form-encoded bodies, including bracketed nested keys. */
  private async call<T>(
    path: string,
    method: 'GET' | 'POST',
    params?: Record<string, string>,
  ): Promise<T> {
    const url =
      method === 'GET' && params
        ? `${this.base}${path}?${new URLSearchParams(params).toString()}`
        : `${this.base}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.secret()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body:
        method === 'POST' && params
          ? new URLSearchParams(params).toString()
          : undefined,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.log.error(`[stripe] ${method} ${path} -> ${res.status}: ${detail.slice(0, 300)}`);
      throw new BadRequestException(`STRIPE_ERROR_${res.status}`);
    }
    return (await res.json()) as T;
  }

  async createCheckoutSession(
    businessId: string,
    planCode: string,
  ): Promise<{ url: string }> {
    const plan = getPlan(planCode);
    if (!plan) throw new BadRequestException(`Unknown plan: ${planCode}`);
    if (plan.priceCents === 0) {
      throw new BadRequestException('FREE_PLAN_NO_CHECKOUT');
    }

    const base = `${this.frontendUrl()}/app/businesses/${businessId}/billing`;
    const params: Record<string, string> = {
      mode: 'subscription',
      client_reference_id: businessId,
      'metadata[planCode]': plan.code,
      'metadata[businessId]': businessId,
      success_url: `${base}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}?canceled=1`,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': plan.currency.toLowerCase(),
      'line_items[0][price_data][product_data][name]': `Portal Studio — ${plan.name}`,
      'line_items[0][price_data][unit_amount]': String(plan.priceCents),
      'line_items[0][price_data][recurring][interval]': plan.interval,
    };
    const session = await this.call<StripeCheckoutSession>(
      '/checkout/sessions',
      'POST',
      params,
    );
    if (!session.url) throw new BadRequestException('STRIPE_NO_URL');
    return { url: session.url };
  }

  /** Verify a returned Checkout session and activate the subscription. */
  async confirmCheckout(businessId: string, sessionId: string) {
    const session = await this.call<StripeCheckoutSession>(
      `/checkout/sessions/${sessionId}`,
      'GET',
      { 'expand[]': 'subscription' },
    );
    if (session.client_reference_id !== businessId) {
      throw new BadRequestException('SESSION_BUSINESS_MISMATCH');
    }
    if (session.payment_status !== 'paid') {
      throw new BadRequestException('PAYMENT_NOT_COMPLETED');
    }
    const planCode = session.metadata?.planCode;
    if (!planCode) throw new BadRequestException('SESSION_MISSING_PLAN');

    const periodEnd = session.subscription?.current_period_end
      ? new Date(session.subscription.current_period_end * 1000)
      : null;
    return this.billing.activateFromStripe(
      businessId,
      planCode,
      session.subscription?.id ?? null,
      periodEnd,
    );
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity';
import { Invoice, InvoiceLineItem } from './invoice.entity';
import { BillingPlan, getPlan, PLAN_CATALOG } from './billing-plans';
import { PlanCapability, planCapabilities } from './plan-capabilities';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

/**
 * GROW hosted payment-page links, keyed by plan code. Public URLs (not secrets)
 * pasted from the GROW dashboard; an env override still takes precedence (see
 * growPaymentUrl). The charged amount lives on the GROW page — keep it in sync
 * with each plan's priceCents in billing-plans.ts.
 */
const GROW_PAYMENT_LINKS: Record<string, string> = {
  basic: 'https://mrng.to/7hq0bWZCAI',
  growth: 'https://mrng.to/IQxohdw2E3',
  exclusive: 'https://mrng.to/RgSB4IhMeF',
};

/** Whether an external billing provider is wired (its keys are in env). */
export interface ProviderStatus {
  name: 'grow' | 'greeninvoice';
  label: string;
  configured: boolean;
}

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(Invoice)
    private readonly invoices: Repository<Invoice>,
    private readonly config: ConfigService,
  ) {}

  plans() {
    return PLAN_CATALOG;
  }

  /**
   * Which payment providers are ready. Both need operator credentials in env;
   * until then the UI shows them as "needs setup" and billing stays manual.
   */
  providerStatus(): ProviderStatus[] {
    return [
      {
        name: 'grow',
        label: 'GROW',
        configured: this.growConfigured(),
      },
      {
        name: 'greeninvoice',
        label: 'חשבונית ירוקה',
        configured: Boolean(this.config.get<string>('GREEN_INVOICE_API_KEY')),
      },
    ];
  }

  /** GROW is "ready" once at least one paid plan has a payment link in env. */
  private growConfigured(): boolean {
    return PLAN_CATALOG.some(
      (p) => p.priceCents > 0 && Boolean(this.growPaymentUrl(p.code)),
    );
  }

  /**
   * The GROW hosted payment-page URL for a plan. These are public payment-page
   * links (not secrets), so they live in code. An env override
   * `GROW_PAYMENT_URL_<CODE>` still wins, so a link can be swapped without a code
   * change. Amounts are set on the GROW page itself — keep them in sync with the
   * plan's `priceCents` in billing-plans.ts.
   */
  private growPaymentUrl(planCode: string): string | undefined {
    const env = this.config
      .get<string>(`GROW_PAYMENT_URL_${planCode.toUpperCase()}`)
      ?.trim();
    return env || GROW_PAYMENT_LINKS[planCode] || undefined;
  }

  /**
   * Start an upgrade: return the plan's GROW payment link. Throws a typed error
   * the UI can surface (rather than failing silently) when the link isn't set
   * yet or a free plan is passed.
   */
  growCheckout(planCode: string): { url: string } {
    const plan = getPlan(planCode);
    if (!plan) throw new BadRequestException(`Unknown plan: ${planCode}`);
    if (plan.priceCents === 0) {
      throw new BadRequestException('FREE_PLAN_NO_CHECKOUT');
    }
    const url = this.growPaymentUrl(planCode);
    if (!url) throw new BadRequestException('PAYMENT_NOT_CONFIGURED');
    return { url };
  }

  /**
   * Returns the business's subscription, lazily creating a default one. There is
   * no free plan any more, so a brand-new business starts on the entry paid tier
   * (`basic`) via manual provisioning — the operator manages who exists and can
   * bump the plan up. This keeps the chat agent working for provisioned tenants
   * without granting any of the higher-tier capabilities.
   */
  async getSubscription(businessId: string): Promise<Subscription> {
    let sub = await this.subscriptions.findOne({ where: { businessId } });
    if (!sub) {
      sub = await this.subscriptions.save(
        this.subscriptions.create({
          businessId,
          planCode: 'basic',
          status: 'active',
          provider: 'manual',
        }),
      );
    }
    return sub;
  }

  /**
   * The capabilities a business currently has, derived from its plan — but only
   * while the subscription is live (active/trialing). This is the enforcement
   * seam: agent tools, Google integration and the manual calendar all resolve
   * access through here rather than trusting a plan's marketing copy.
   */
  async getCapabilities(businessId: string): Promise<Set<PlanCapability>> {
    const sub = await this.getSubscription(businessId);
    const live = sub.status === 'active' || sub.status === 'trialing';
    return new Set(live ? planCapabilities(sub.planCode) : []);
  }

  /** Convenience: does the business's live plan include a given capability? */
  async hasCapability(
    businessId: string,
    capability: PlanCapability,
  ): Promise<boolean> {
    return (await this.getCapabilities(businessId)).has(capability);
  }

  async setPlan(businessId: string, planCode: string): Promise<Subscription> {
    if (!getPlan(planCode)) {
      throw new BadRequestException(`Unknown plan: ${planCode}`);
    }
    const sub = await this.getSubscription(businessId);
    sub.planCode = planCode;
    sub.status = 'active';
    return this.subscriptions.save(sub);
  }

  /**
   * Map a paid amount (in agorot) back to the plan it corresponds to. GROW
   * payment links are shared per plan and the plan isn't in the webhook, so the
   * amount is how we recover which plan was bought. Returns undefined if no plan
   * matches — the caller then refuses to activate rather than guess.
   */
  planForAmountCents(amountCents: number): BillingPlan | undefined {
    return PLAN_CATALOG.find(
      (p) => p.priceCents > 0 && p.priceCents === amountCents,
    );
  }

  /** Activate/upgrade a subscription after a successful GROW/morning payment. */
  async activateFromMorning(
    businessId: string,
    planCode: string,
    ref: string | null,
  ): Promise<Subscription> {
    const sub = await this.getSubscription(businessId);
    sub.planCode = planCode;
    sub.status = 'active';
    sub.provider = 'morning';
    sub.providerRef = ref;
    return this.subscriptions.save(sub);
  }

  /** Activate/upgrade a subscription after a successful Stripe checkout. */
  async activateFromStripe(
    businessId: string,
    planCode: string,
    subscriptionId: string | null,
    currentPeriodEnd: Date | null,
  ): Promise<Subscription> {
    const sub = await this.getSubscription(businessId);
    sub.planCode = planCode;
    sub.status = 'active';
    sub.provider = 'stripe';
    sub.providerRef = subscriptionId;
    sub.currentPeriodEnd = currentPeriodEnd;
    return this.subscriptions.save(sub);
  }

  listInvoices(businessId: string): Promise<Invoice[]> {
    return this.invoices.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async createInvoice(
    businessId: string,
    dto: CreateInvoiceDto,
  ): Promise<Invoice> {
    const lineItems: InvoiceLineItem[] = dto.lineItems.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
    }));
    const amountCents = lineItems.reduce(
      (sum, l) => sum + l.quantity * l.unitPriceCents,
      0,
    );
    // Invoice numbers are (business, number)-unique at the DB. Under concurrent
    // creates two rows can compute the same count+1 number; retry a few times
    // on the unique-violation so we never emit a duplicate legal document.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.invoices.save(
          this.invoices.create({
            businessId,
            number: await this.nextInvoiceNumber(businessId),
            status: 'draft',
            customerName: dto.customerName ?? null,
            amountCents,
            currency: 'ILS',
            lineItems,
            issuedAt: new Date(),
            dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          }),
        );
      } catch (err) {
        // Postgres unique_violation — collide on number, regenerate and retry.
        if ((err as { code?: string }).code === '23505' && attempt < 4) {
          continue;
        }
        throw err;
      }
    }
    throw new Error('INVOICE_NUMBER_ALLOCATION_FAILED');
  }

  async markInvoicePaid(businessId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoices.findOne({ where: { id, businessId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    return this.invoices.save(invoice);
  }

  private async nextInvoiceNumber(businessId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.invoices.count({ where: { businessId } });
    return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

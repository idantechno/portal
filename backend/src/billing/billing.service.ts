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
import { getPlan, PLAN_CATALOG } from './billing-plans';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

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
   * The GROW hosted payment-page URL for a plan, from env
   * `GROW_PAYMENT_URL_<CODE>` (e.g. GROW_PAYMENT_URL_GROWTH). Kept in env so the
   * operator can paste the links straight from the GROW dashboard — no payment
   * secrets live in the codebase.
   */
  private growPaymentUrl(planCode: string): string | undefined {
    const raw = this.config.get<string>(
      `GROW_PAYMENT_URL_${planCode.toUpperCase()}`,
    );
    return raw?.trim() || undefined;
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

  /** Returns the business's subscription, lazily creating a free one. */
  async getSubscription(businessId: string): Promise<Subscription> {
    let sub = await this.subscriptions.findOne({ where: { businessId } });
    if (!sub) {
      sub = await this.subscriptions.save(
        this.subscriptions.create({
          businessId,
          planCode: 'free',
          status: 'active',
          provider: 'manual',
        }),
      );
    }
    return sub;
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

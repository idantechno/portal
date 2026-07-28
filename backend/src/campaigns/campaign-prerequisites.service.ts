import { Injectable } from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';
import { PlansService } from '../plans/plans.service';
import { QuotesService } from '../quotes/quotes.service';
import { ObjectivesService } from '../objectives/objectives.service';

/** The stable keys of the campaign prerequisites — order = display order. */
export type PrerequisiteKey =
  | 'brand_page'
  | 'logo'
  | 'marketing_plan'
  | 'quote'
  | 'goals';

export interface PrerequisiteItem {
  key: PrerequisiteKey;
  label: string;
  /** Whether this prerequisite is satisfied for the customer. */
  met: boolean;
  /**
   * Whether this prerequisite type is even buildable in the product yet. The
   * ones still on the roadmap (quote, brand page, logo, goals) report
   * `available: false` so the UI can show them as "בבנייה" rather than a plain
   * unmet check — they hard-block campaign creation until built.
   */
  available: boolean;
  /** Short reason / hint shown under the item. */
  hint: string;
}

export interface PrerequisiteReport {
  items: PrerequisiteItem[];
  /** True only when every prerequisite is met — the campaign gate. */
  allMet: boolean;
}

/**
 * Computes the hard prerequisite gate for creating a campaign. A campaign for a
 * customer may only be created once EVERY item is met. Today only the marketing
 * plan is checkable; the rest are on the roadmap and therefore always unmet,
 * which is the intended hard block until they are built.
 */
@Injectable()
export class CampaignPrerequisitesService {
  constructor(
    private readonly customers: CustomersService,
    private readonly plans: PlansService,
    private readonly quotes: QuotesService,
    private readonly objectives: ObjectivesService,
  ) {}

  async report(
    businessId: string,
    customerId: string,
  ): Promise<PrerequisiteReport> {
    const [customer, plans, hasApprovedQuote, hasApprovedObjectives] =
      await Promise.all([
        this.customers.findByIdScoped(businessId, customerId),
        this.plans.list(businessId, customerId),
        this.quotes.hasApproved(businessId, customerId),
        this.objectives.hasApproved(businessId, customerId),
      ]);
    const hasApprovedPlan = plans.some((p) => p.status === 'approved');

    const items: PrerequisiteItem[] = [
      {
        key: 'brand_page',
        label: 'דף מותג',
        met: customer.brandPageReady,
        available: true,
        hint: customer.brandPageReady
          ? 'סומן כקיים.'
          : 'שפה עיצובית (סגנון, צבעים, פונטים) — נוצר מחוץ למערכת; סמן שקיים בכרטיס הלקוח.',
      },
      {
        key: 'logo',
        label: 'לוגו',
        met: customer.logoReady,
        available: true,
        hint: customer.logoReady
          ? 'סומן כקיים.'
          : 'לוגו הלקוח — מובא מבחוץ; סמן שקיים בכרטיס הלקוח.',
      },
      {
        key: 'marketing_plan',
        label: 'תוכנית שיווק',
        met: hasApprovedPlan,
        available: true,
        hint: hasApprovedPlan
          ? 'קיימת תוכנית עבודה מאושרת.'
          : 'צריך תוכנית עבודה מאושרת (בריף → אסטרטגיה → תוכנית).',
      },
      {
        key: 'quote',
        label: 'הצעת מחיר',
        met: hasApprovedQuote,
        available: true,
        hint: hasApprovedQuote
          ? 'קיימת הצעת מחיר מאושרת.'
          : 'צריך הצעת מחיר מאושרת (מסלול לקוח, ערוצי שיווק ותקציב) — נבנית אצל סוכן הצעות המחיר.',
      },
      {
        key: 'goals',
        label: 'יעדים ומטרות',
        met: hasApprovedObjectives,
        available: true,
        hint: hasApprovedObjectives
          ? 'קיים מסמך יעדים ומטרות מאושר.'
          : 'צריך מסמך יעדים ומטרות מאושר (מטרות, מדדי הצלחה, קהל יעד).',
      },
    ];

    return { items, allMet: items.every((i) => i.met) };
  }
}

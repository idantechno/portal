import { Injectable } from '@nestjs/common';
import { PlansService } from '../plans/plans.service';

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
  constructor(private readonly plans: PlansService) {}

  async report(
    businessId: string,
    customerId: string,
  ): Promise<PrerequisiteReport> {
    const plans = await this.plans.list(businessId, customerId);
    const hasApprovedPlan = plans.some((p) => p.status === 'approved');

    const items: PrerequisiteItem[] = [
      {
        key: 'brand_page',
        label: 'דף מותג',
        met: false,
        available: false,
        hint: 'שפה עיצובית: סגנון, צבעים ופונטים. (בבנייה)',
      },
      {
        key: 'logo',
        label: 'לוגו',
        met: false,
        available: false,
        hint: 'לוגו הלקוח. (בבנייה)',
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
        met: false,
        available: false,
        hint: 'כוללת מסלול לקוח, ערוצי שיווק ותקציב. (בבנייה)',
      },
      {
        key: 'goals',
        label: 'יעדים ומטרות',
        met: false,
        available: false,
        hint: 'מטרות הקמפיין, מדדי הצלחה וקהל יעד. (בבנייה)',
      },
    ];

    return { items, allMet: items.every((i) => i.met) };
  }
}

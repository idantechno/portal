/**
 * Code-defined subscription plans Portal Studio sells. Like the agent catalog,
 * this is the source-of-truth list; a business's chosen plan is a row in
 * `subscriptions`. Prices are in agorot (₪ * 100) to avoid float drift.
 *
 * What each plan actually UNLOCKS lives in `plan-capabilities.ts` (keyed by the
 * `code` here). The `features` strings below are the customer-facing copy; the
 * capability map is what the code enforces. Keep the two in sync.
 */
export interface BillingPlan {
  code: string;
  /** Hebrew plan name. */
  name: string;
  /** English plan name (shown alongside the Hebrew one). */
  nameEn: string;
  /** One-line lead/tagline for the plan card. */
  tagline: string;
  priceCents: number;
  interval: 'month' | 'year';
  currency: 'ILS';
  /** Fair-use monthly conversation cap; null = unlimited. */
  monthlyConversationCap: number | null;
  features: string[];
}

export const PLAN_CATALOG: readonly BillingPlan[] = [
  {
    code: 'basic',
    name: 'בסיס',
    nameEn: 'Basic',
    tagline: 'הסוכן שעונה ללקוחות שלך 24/7',
    priceCents: 39000,
    interval: 'month',
    currency: 'ILS',
    monthlyConversationCap: 1000,
    features: [
      'סוכן צ׳אט — עונה ומוסר מידע',
      'וואטסאפ + ווידג׳ט אתר',
      'CRM',
      'עד 1,000 שיחות בחודש',
    ],
  },
  {
    code: 'growth',
    name: 'צמיחה',
    nameEn: 'Growth',
    tagline: 'כל צוות הסוכנים + יומן ומשימות',
    priceCents: 59000,
    interval: 'month',
    currency: 'ILS',
    monthlyConversationCap: 3000,
    features: [
      'כל מה שבבסיס',
      'יומן ומשימות (הזנה ידנית)',
      'סוכני מסמכים, שיווק ואנליטיקה',
      'אוטומציות',
      'עד 3,000 שיחות בחודש',
    ],
  },
  {
    code: 'exclusive',
    name: 'אקסקלוסיב',
    nameEn: 'Exclusive',
    tagline: 'אוטומציה מלאה — הסוכן סוגר פגישות ומחובר לגוגל',
    priceCents: 71900,
    interval: 'month',
    currency: 'ILS',
    monthlyConversationCap: null,
    features: [
      'כל מה שבצמיחה',
      'הסוכן סוגר, מבטל ומזיז פגישות',
      'חיבור Google (Gmail + יומן)',
      'כל צוות הסוכנים + תזכורות',
      'שיחות ללא הגבלה',
      'תמיכה מועדפת',
    ],
  },
];

export function getPlan(code: string): BillingPlan | undefined {
  return PLAN_CATALOG.find((p) => p.code === code);
}

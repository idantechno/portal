/**
 * Code-defined subscription plans Portal Studio sells. Like the agent catalog,
 * this is the source-of-truth list; a business's chosen plan is a row in
 * `subscriptions`. Prices are in agorot (₪ * 100) to avoid float drift.
 */
export interface BillingPlan {
  code: string;
  name: string;
  priceCents: number;
  interval: 'month' | 'year';
  currency: 'ILS';
  features: string[];
}

export const PLAN_CATALOG: readonly BillingPlan[] = [
  {
    code: 'free',
    name: 'התחלה',
    priceCents: 0,
    interval: 'month',
    currency: 'ILS',
    features: ['ווידג׳ט אתר', 'CRM בסיסי', 'סוכן צ׳אט'],
  },
  {
    code: 'growth',
    name: 'צמיחה',
    priceCents: 29900,
    interval: 'month',
    currency: 'ILS',
    features: [
      'כל מה שבהתחלה',
      'סוכני מסמכים, שיווק ואנליטיקה',
      'אוטומציות',
      'מערכת משימות',
    ],
  },
  {
    code: 'scale',
    name: 'התרחבות',
    priceCents: 59900,
    interval: 'month',
    currency: 'ILS',
    features: [
      'כל מה שבצמיחה',
      'כל צוות הסוכנים',
      'אינטגרציות Google',
      'תמיכה מועדפת',
    ],
  },
];

export function getPlan(code: string): BillingPlan | undefined {
  return PLAN_CATALOG.find((p) => p.code === code);
}

/**
 * Code-defined catalog of agent "products" the platform offers. Adding a new
 * agent = adding an entry here + building its module + gating its routes with
 * @RequireAgent(key). Per-business access is granted in the business_agents
 * table by an admin; this file is just the source-of-truth list of what exists.
 *
 * This roster is the target architecture of the Portal "Business OS": Meta's
 * WhatsApp agent answers at the edge (ingested, not built here); the Main agent
 * ("הסוכן הראשי") is the always-on hub that reads context, dispatches to the
 * specialized agents below, and escalates to staff. `status: 'soon'` agents are
 * catalogued (so the vision is visible and admins can pre-grant) but their
 * generation flow may still be a stub.
 */
export const AGENT_KEYS = [
  'main',
  'chat',
  'sales',
  'crm',
  'documents',
  'quote',
  'accounting',
  'marketing',
  'analytics',
  'ideas',
  'designer',
  'reminders',
] as const;

export type AgentKey = (typeof AGENT_KEYS)[number];

/** Product pillar the agent belongs to — drives grouping in the UI. */
export type AgentPillar =
  | 'conversations'
  | 'orchestration'
  | 'sales'
  | 'content'
  | 'documents'
  | 'finance'
  | 'growth';

export interface AgentDefinition {
  key: AgentKey;
  name: string;
  description: string;
  /** Icon slug resolved by the frontend icon set (see components/icons.tsx). */
  icon: string;
  /** Seeded value when a business is created — still revocable by an admin. */
  defaultEnabled: boolean;
  /** 'live' = generation flow built; 'soon' = catalogued, flow still a stub. */
  status: 'live' | 'soon';
  pillar: AgentPillar;
}

export const AGENT_CATALOG: readonly AgentDefinition[] = [
  {
    key: 'main',
    name: 'הסוכן הראשי',
    description:
      'הלב של המערכת: מבין מה אתה צריך, מנתב לסוכן הנכון, ומעביר פניות לצוות.',
    icon: 'compass',
    // The always-available entry point + router — never admin-gated (capability
    // null below), so every business always has somewhere to start. Folds in the
    // former "Portal Orchestrator", which did the same job with less.
    defaultEnabled: true,
    status: 'live',
    pillar: 'orchestration',
  },
  {
    key: 'chat',
    name: 'סוכן צ׳אט',
    description: 'מענה אוטומטי ללקוחות ב-WhatsApp ובווידג׳ט האתר.',
    icon: 'chat',
    defaultEnabled: false,
    status: 'live',
    pillar: 'conversations',
  },
  {
    key: 'sales',
    name: 'סוכן מכירות',
    description: 'מעקב אחרי לידים, נרצ׳רינג ודחיפת עסקאות לסגירה.',
    icon: 'leads',
    defaultEnabled: false,
    status: 'live',
    pillar: 'sales',
  },
  {
    key: 'crm',
    name: 'סוכן CRM',
    description:
      'תחזוקת רשומות לקוח: העשרה, תיוג, עדכון סטטוס ומניעת כפילויות.',
    icon: 'users',
    defaultEnabled: false,
    status: 'live',
    pillar: 'sales',
  },
  {
    key: 'documents',
    name: 'סוכן מסמכים',
    description: 'הפקת הצעות מחיר, חוזים והזמנות עבודה לחתימה.',
    icon: 'doc',
    defaultEnabled: false,
    status: 'live',
    pillar: 'documents',
  },
  {
    key: 'quote',
    name: 'סוכן הצעות מחיר',
    description: 'בניית הצעות מחיר מתומחרות מתוך בקשת הלקוח.',
    icon: 'pencil',
    defaultEnabled: false,
    status: 'live',
    pillar: 'documents',
  },
  {
    key: 'accounting',
    name: 'סוכן הנהלת חשבונות',
    description: 'חשבוניות, מעקב תשלומים והוצאות עבור עסקאות שנסגרו.',
    icon: 'receipt',
    defaultEnabled: false,
    status: 'live',
    pillar: 'finance',
  },
  {
    key: 'marketing',
    name: 'סוכן שיווק',
    description: 'ניסוח תוכן, פוסטים לרשתות, קמפיינים וקופי מותג.',
    icon: 'megaphone',
    defaultEnabled: false,
    status: 'live',
    pillar: 'content',
  },
  {
    key: 'analytics',
    name: 'סוכן אנליטיקה',
    description: 'תובנות והמלצות "מה לשפר השבוע" מתוך נתוני העסק.',
    icon: 'chart',
    defaultEnabled: false,
    status: 'live',
    pillar: 'growth',
  },
  {
    key: 'ideas',
    name: 'סוכן רעיונות',
    description:
      'לוכד רעיונות גולמיים, מלטש אותם ומפתח אותם לכיוונים ומהלכים לעסק.',
    icon: 'idea',
    defaultEnabled: false,
    status: 'live',
    pillar: 'growth',
  },
  {
    key: 'designer',
    name: 'סוכן מעצב גרפי',
    description:
      'מייצר מוצרים מעוצבים פשוטים להדפסה — תפריט, כרזה, מחירון, הזמנה — בצבעי העסק.',
    icon: 'palette',
    defaultEnabled: false,
    status: 'live',
    pillar: 'content',
  },
  {
    key: 'reminders',
    name: 'סוכן תזכורות',
    description:
      'שלא תשכח מעקבים ומשימות: תזכורות עם תאריך יעד — באיחור / היום / בקרוב.',
    icon: 'clock',
    defaultEnabled: false,
    status: 'live',
    pillar: 'growth',
  },
];

/**
 * Which plan capability unlocks each agent by default. `null` = always available
 * (infra agents that every tenant needs). This is the plan→agent default; an
 * explicit `business_agents` row still overrides it BOTH ways, so an admin can
 * grant an above-plan agent to one business or revoke an in-plan one. To move an
 * agent between tiers, change the one line here (see `plan-capabilities.ts`).
 */
export const AGENT_REQUIRED_CAPABILITY: Record<
  AgentKey,
  import('../billing/plan-capabilities').PlanCapability | null
> = {
  main: null, // always-on entry point + router (folds in the old orchestrator)
  chat: 'chat', // basic+
  crm: 'crm', // basic+
  documents: 'pro_agents', // growth+
  marketing: 'pro_agents', // growth+
  analytics: 'pro_agents', // growth+
  sales: 'all_agents', // exclusive
  quote: 'all_agents', // exclusive
  accounting: 'all_agents', // exclusive
  ideas: 'all_agents', // exclusive
  designer: 'all_agents', // exclusive
  reminders: 'all_agents', // exclusive
};

export function isAgentKey(key: string): key is AgentKey {
  return (AGENT_KEYS as readonly string[]).includes(key);
}

export function getAgentDefinition(key: string): AgentDefinition | undefined {
  return AGENT_CATALOG.find((a) => a.key === key);
}

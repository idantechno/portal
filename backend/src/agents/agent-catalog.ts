/**
 * Code-defined catalog of agent "products" the platform offers. Adding a new
 * agent = adding an entry here + building its module + gating its routes with
 * @RequireAgent(key). Per-business access is granted in the business_agents
 * table by an admin; this file is just the source-of-truth list of what exists.
 *
 * This roster is the target architecture of the Portal "Business OS": Meta's
 * WhatsApp agent answers at the edge (ingested, not built here); the Portal
 * Orchestrator is the hub that reads context and dispatches to the specialized
 * agents below. `status: 'soon'` agents are catalogued (so the vision is visible
 * and admins can pre-grant) but their generation flow may still be a stub.
 */
export const AGENT_KEYS = [
  'chat',
  'orchestrator',
  'sales',
  'crm',
  'documents',
  'quote',
  'accounting',
  'marketing',
  'analytics',
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
  icon: string;
  /** Seeded value when a business is created — still revocable by an admin. */
  defaultEnabled: boolean;
  /** 'live' = generation flow built; 'soon' = catalogued, flow still a stub. */
  status: 'live' | 'soon';
  pillar: AgentPillar;
}

export const AGENT_CATALOG: readonly AgentDefinition[] = [
  {
    key: 'chat',
    name: 'סוכן צ׳אט',
    description: 'מענה אוטומטי ללקוחות ב-WhatsApp ובווידג׳ט האתר.',
    icon: '💬',
    defaultEnabled: true,
    status: 'live',
    pillar: 'conversations',
  },
  {
    key: 'orchestrator',
    name: 'Portal Orchestrator',
    description:
      'הלב של המערכת: קורא את ההקשר העסקי ומנתב כל משימה לסוכן המתאים.',
    icon: '🧭',
    defaultEnabled: false,
    status: 'soon',
    pillar: 'orchestration',
  },
  {
    key: 'sales',
    name: 'סוכן מכירות',
    description: 'מעקב אחרי לידים, נרצ׳רינג ודחיפת עסקאות לסגירה.',
    icon: '🤝',
    defaultEnabled: false,
    status: 'soon',
    pillar: 'sales',
  },
  {
    key: 'crm',
    name: 'סוכן CRM',
    description:
      'תחזוקת רשומות לקוח: העשרה, תיוג, עדכון סטטוס ומניעת כפילויות.',
    icon: '🗂️',
    defaultEnabled: false,
    status: 'soon',
    pillar: 'sales',
  },
  {
    key: 'documents',
    name: 'סוכן מסמכים',
    description: 'הפקת הצעות מחיר, חוזים והזמנות עבודה לחתימה.',
    icon: '📝',
    defaultEnabled: false,
    status: 'live',
    pillar: 'documents',
  },
  {
    key: 'quote',
    name: 'סוכן הצעות מחיר',
    description: 'בניית הצעות מחיר מתומחרות מתוך בקשת הלקוח.',
    icon: '💰',
    defaultEnabled: false,
    status: 'soon',
    pillar: 'documents',
  },
  {
    key: 'accounting',
    name: 'סוכן הנהלת חשבונות',
    description: 'חשבוניות, מעקב תשלומים והוצאות עבור עסקאות שנסגרו.',
    icon: '🧾',
    defaultEnabled: false,
    status: 'soon',
    pillar: 'finance',
  },
  {
    key: 'marketing',
    name: 'סוכן שיווק',
    description: 'ניסוח תוכן, פוסטים לרשתות, קמפיינים וקופי מותג.',
    icon: '📣',
    defaultEnabled: true,
    status: 'live',
    pillar: 'content',
  },
  {
    key: 'analytics',
    name: 'סוכן אנליטיקה',
    description: 'תובנות והמלצות "מה לשפר השבוע" מתוך נתוני העסק.',
    icon: '📊',
    defaultEnabled: true,
    status: 'live',
    pillar: 'growth',
  },
];

export function isAgentKey(key: string): key is AgentKey {
  return (AGENT_KEYS as readonly string[]).includes(key);
}

export function getAgentDefinition(key: string): AgentDefinition | undefined {
  return AGENT_CATALOG.find((a) => a.key === key);
}

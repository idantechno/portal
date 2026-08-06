/**
 * Catalog of WhatsApp message templates the platform can send on a business's
 * behalf. Mirrors the agent catalog: code is the source of truth, each entry
 * is granted per business (an explicit `business_templates` row overrides the
 * catalog default).
 *
 * BASE templates (`defaultEnabled: true`) are on for every business — the
 * generic reminders/appointment confirmations everyone benefits from. SPECIAL
 * templates (`defaultEnabled: false`) are industry- or client-specific: the
 * operator gets one approved by Meta/360dialog, adds it here, and grants it to
 * the ONE business that asked — like granting an agent.
 *
 * `trigger` says which existing event fires the template, so a special template
 * can hook onto an event we already emit (e.g. a bespoke "appointment_booked"
 * variant) without new plumbing.
 */
export interface TemplateDefinition {
  /** The exact approved template name at Meta/360dialog. */
  name: string;
  /** Hebrew display title (what the owner sees). */
  title: string;
  /** Hebrew one-liner: what it does / when it's sent. */
  description: string;
  /** Seeded default — base templates on for all, special ones off. Revocable. */
  defaultEnabled: boolean;
  /** Which event sends it. */
  trigger: 'reminder' | 'appointment_booked';
}

export const TEMPLATE_CATALOG: readonly TemplateDefinition[] = [
  {
    name: 'reminder',
    title: 'תזכורת',
    description:
      'נשלחת אוטומטית אליך (ולפעמים ללקוח) כשמגיע מועד של תזכורת או פגישה.',
    defaultEnabled: true,
    trigger: 'reminder',
  },
  {
    name: 'appointment_booked',
    title: 'אישור קביעת פגישה',
    description: 'נשלחת כשנקבעת פגישה — מאשרת את היום והשעה.',
    defaultEnabled: true,
    trigger: 'appointment_booked',
  },
];

export function isTemplateName(name: string): boolean {
  return TEMPLATE_CATALOG.some((t) => t.name === name);
}

export function getTemplate(name: string): TemplateDefinition | undefined {
  return TEMPLATE_CATALOG.find((t) => t.name === name);
}

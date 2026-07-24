/**
 * 🔵 The questionnaire layer of a brief.
 *
 * Turns a stored questionnaire submission (the lead's `answers` jsonb) back
 * into typed facts: for every question we keep both the text the client wrote
 * and — for radio/checkbox questions — the semantic option values, which is
 * what the contradiction checks reason over.
 *
 * The one rule that matters: a question that wasn't answered resolves to
 * `UNKNOWN`, never to an empty string. An empty field is what makes a model
 * invent; an explicit "⟨לא ידוע⟩" is what stops it.
 */

import {
  QField,
  Q_FIELDS,
  Q_FIELD_BY_ID,
  Q_FIELD_BY_LABEL,
  normalizeLabel,
} from './questionnaire-schema';

export const UNKNOWN = '⟨לא ידוע⟩';

export interface RawAnswerItem {
  id?: string;
  label?: string;
  value?: string;
}
export interface RawAnswerSection {
  title?: string;
  items?: RawAnswerItem[];
}
export interface RawAnswers {
  businessName?: string;
  businessType?: string;
  audience?: string;
  contactName?: string;
  phone?: string | null;
  email?: string | null;
  preferredChannel?: string | null;
  sections?: RawAnswerSection[];
}

export type BusinessBranch = 'service' | 'product' | 'both' | null;

export interface BriefFacts {
  /** Which wizard branch the client went down — decides which questions apply. */
  businessType: BusinessBranch;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  preferredChannel: string;
  /** field id → the answer exactly as the client gave it (or UNKNOWN). */
  text: Record<string, string>;
  /** field id → picked option values ("__other__:free text" for אחר). */
  values: Record<string, string[]>;
  /** Field ids with no answer at all — drives the "what's still missing" list. */
  missing: string[];
}

const BUSINESS_TYPE_LABEL: Record<string, string> = {
  service: 'עסק שנותן שירות',
  product: 'עסק שמוכר מוצרים',
  both: 'שירות ומוצר',
};
const AUDIENCE_LABEL: Record<string, string> = {
  b2b: 'עסקים (B2B)',
  b2c: 'לקוחות פרטיים (B2C)',
  both: 'עסקיים ופרטיים',
};
const CHANNEL_LABEL: Record<string, string> = {
  phone: 'טלפון',
  whatsapp: 'וואטסאפ',
  email: 'אימייל',
};

/** Reverse-maps a rendered Hebrew answer back to its option value(s). */
function toValues(field: QField, rendered: string): string[] {
  if (!field.options) return [];
  const byLabel = new Map(
    Object.entries(field.options).map(([value, label]) => [
      normalizeLabel(label),
      value,
    ]),
  );
  const parts =
    field.type === 'checkbox'
      ? rendered.split(',').map((p) => p.trim())
      : [rendered.trim()];

  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('אחר')) {
      const free = part.replace(/^אחר\s*:?\s*/, '').trim();
      out.push(free ? `__other__:${free}` : '__other__');
      continue;
    }
    const value = byLabel.get(normalizeLabel(part));
    out.push(value ?? `__other__:${part}`);
  }
  return out;
}

/**
 * Whether a question even applies to this submission. The wizard branches —
 * a service business is never asked the product questions — so those fields
 * must not show up as "unanswered", and must not be printed as ⟨לא ידוע⟩ rows
 * that read like missing information.
 */
function isRelevantField(
  fieldId: string,
  businessType: BusinessBranch,
  values: Record<string, string[]>,
): boolean {
  const field = Q_FIELD_BY_ID[fieldId];
  if (!field) return false;
  if (field.branch && businessType && businessType !== 'both') {
    if (field.branch !== businessType) return false;
  }
  // The monthly size is only asked when a fixed budget was declared.
  if (fieldId === 'q24_budget_size') {
    return (values.q23_has_budget ?? []).includes('yes');
  }
  return true;
}

export function isRelevant(facts: BriefFacts, fieldId: string): boolean {
  return isRelevantField(fieldId, facts.businessType, facts.values);
}

/** Accepts the raw `answers` jsonb — shape is validated field by field below,
 *  and anything unrecognised is dropped rather than guessed at. */
export function buildFacts(answers: unknown): BriefFacts {
  const a = (answers ?? {}) as RawAnswers;
  const text: Record<string, string> = {};
  const values: Record<string, string[]> = {};

  // Promoted top-level fields never appear inside `sections`.
  const promoted: Array<[string, string | null | undefined, string[]]> = [
    ['businessType', a.businessType, a.businessType ? [a.businessType] : []],
    ['audience', a.audience, a.audience ? [a.audience] : []],
    ['businessName', a.businessName, []],
    ['contactName', a.contactName, []],
    ['phone', a.phone, []],
    ['email', a.email, []],
    [
      'preferredChannel',
      a.preferredChannel,
      a.preferredChannel ? [a.preferredChannel] : [],
    ],
  ];
  for (const [id, raw, vals] of promoted) {
    const label =
      id === 'businessType'
        ? BUSINESS_TYPE_LABEL[String(raw ?? '')]
        : id === 'audience'
          ? AUDIENCE_LABEL[String(raw ?? '')]
          : id === 'preferredChannel'
            ? CHANNEL_LABEL[String(raw ?? '')]
            : typeof raw === 'string'
              ? raw.trim()
              : '';
    if (label) text[id] = label;
    if (vals.length) values[id] = vals;
  }

  for (const section of a.sections ?? []) {
    for (const item of section.items ?? []) {
      const value = (item.value ?? '').trim();
      if (!value) continue;
      const field =
        (item.id ? Q_FIELD_BY_ID[item.id] : undefined) ??
        (item.label ? Q_FIELD_BY_LABEL[normalizeLabel(item.label)] : undefined);
      if (!field) continue; // A question we don't know about — ignored, never guessed.
      text[field.id] = value;
      const vals = toValues(field, value);
      if (vals.length) values[field.id] = vals;
    }
  }

  const businessType = (a.businessType ?? null) as BusinessBranch;
  const missing = Q_FIELDS.filter(
    (f) => !text[f.id] && isRelevantField(f.id, businessType, values),
  ).map((f) => f.id);

  return {
    businessType,
    businessName: text.businessName || UNKNOWN,
    contactName: text.contactName || UNKNOWN,
    phone: text.phone || UNKNOWN,
    email: text.email || UNKNOWN,
    preferredChannel: text.preferredChannel || UNKNOWN,
    text,
    values,
    missing,
  };
}

/** The answer to a question, or the explicit unknown marker. */
export function answer(facts: BriefFacts, fieldId: string): string {
  const v = facts.text[fieldId];
  return v && v.trim() ? v.trim() : UNKNOWN;
}

/** Joins several answers into one line, skipping the ones we don't have. */
export function answers(facts: BriefFacts, fieldIds: string[]): string {
  const parts = fieldIds
    .map((id) => facts.text[id]?.trim())
    .filter((v): v is string => Boolean(v));
  return parts.length ? parts.join(' · ') : UNKNOWN;
}

export function hasValue(
  facts: BriefFacts,
  fieldId: string,
  value: string,
): boolean {
  return (facts.values[fieldId] ?? []).includes(value);
}

/** Renders the whole submission as labelled Q/A text — the model's 🔵 input. */
export function renderFactsForPrompt(facts: BriefFacts): string {
  const lines: string[] = [];
  let step = 0;
  for (const field of Q_FIELDS) {
    if (!isRelevant(facts, field.id)) continue;
    if (field.step !== step) {
      step = field.step;
      lines.push('', `--- שלב ${step} ---`);
    }
    lines.push(`[${field.id}] ${field.label}: ${answer(facts, field.id)}`);
  }
  return lines.join('\n').trim();
}

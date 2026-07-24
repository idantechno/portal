/**
 * ⚠️ Contradiction detection.
 *
 * Clients answer a 10-step questionnaire in one sitting, and answers routinely
 * disagree with each other ("לקוחות מגיעים מהמלצות" + "עדיין אין לקוחות").
 * The brief must surface both answers side by side instead of silently picking
 * one — a hidden contradiction becomes an invented fact downstream.
 *
 * These are deterministic checks over the option values, not a model call:
 * the same submission always produces the same warnings.
 */

import { BriefFacts, answer, hasValue } from './brief-facts';
import { Q_FIELD_BY_ID } from './questionnaire-schema';

export interface Contradiction {
  code: string;
  /** One line, ready to be printed under ⚠️ in the brief. */
  text: string;
}

function pick(facts: BriefFacts, id: string): string[] {
  return facts.values[id] ?? [];
}

/** Option values back to their Hebrew labels — warnings are read by a human. */
function labels(fieldId: string, values: string[]): string {
  const options = Q_FIELD_BY_ID[fieldId]?.options ?? {};
  return values
    .map((v) =>
      v.startsWith('__other__')
        ? v.slice('__other__:'.length) || 'אחר'
        : (options[v] ?? v),
    )
    .join(', ');
}

export function detectContradictions(facts: BriefFacts): Contradiction[] {
  const out: Contradiction[] = [];
  const add = (code: string, text: string) => out.push({ code, text });

  const sources = pick(facts, 'q12_sources');
  const assets = pick(facts, 'q30_assets');
  const blockers = pick(facts, 'q28_blocker');
  const describe = pick(facts, 'q31_describe');

  // "אין לקוחות" ticked together with actual lead sources.
  if (sources.includes('none') && sources.length > 1) {
    add(
      'sources_none_and_some',
      `מקורות הלקוחות: סומן «עדיין אין לקוחות (בהקמה)» ויחד איתו ${labels(
        'q12_sources',
        sources.filter((s) => s !== 'none'),
      )} — לברר מה נכון.`,
    );
  }

  // "אין נכסים דיגיטליים" ticked together with actual assets.
  if (assets.includes('none') && assets.length > 1) {
    add(
      'assets_none_and_some',
      'נכסים דיגיטליים: סומן «עדיין אין נכסים» ויחד איתו נכסים קיימים — לברר מה קיים בפועל.',
    );
  }

  // Business is running for years, but the blocker says "עדיין לא התחלתי".
  const age = pick(facts, 'q4_age')[0];
  if (
    blockers.includes('not_started') &&
    (age === '1_3' || age === '3_5' || age === 'over_5')
  ) {
    add(
      'age_vs_not_started',
      `ותק העסק: «${answer(facts, 'q4_age')}» אבל החסם שסומן הוא «עדיין לא התחלתי / בהקמה» — לברר באיזה שלב העסק באמת נמצא.`,
    );
  }

  // Not launched yet, but reports live lead sources.
  if (age === 'not_launched' && sources.some((s) => s !== 'none')) {
    add(
      'not_launched_vs_sources',
      'העסק סומן כ«עדיין לא הושק» אבל דווחו מקורות לקוחות פעילים — לברר.',
    );
  }

  // Says customers come from a website, but no website/landing page exists.
  if (
    sources.includes('website') &&
    !assets.includes('website') &&
    !assets.includes('landing')
  ) {
    add(
      'website_source_without_asset',
      'סומן שלקוחות מגיעים מאתר אינטרנט, אבל אתר/דף נחיתה לא נכלל ברשימת הנכסים הדיגיטליים.',
    );
  }

  // Same for the social channels — a source that isn't a declared asset.
  for (const channel of ['instagram', 'facebook', 'tiktok'] as const) {
    if (sources.includes(channel) && !assets.includes(channel)) {
      add(
        `source_without_asset_${channel}`,
        `סומן שלקוחות מגיעים מ${labelOf(channel)}, אבל הערוץ לא נכלל ברשימת הנכסים הדיגיטליים.`,
      );
    }
  }

  // Has a fixed budget but never said how much.
  if (hasValue(facts, 'q23_has_budget', 'yes') && !facts.text.q24_budget_size) {
    add(
      'budget_yes_no_size',
      'דווח שיש תקציב שיווק קבוע, אבל סדר הגודל החודשי לא נמסר.',
    );
  }
  // Declares no budget yet reports a monthly size.
  if (hasValue(facts, 'q23_has_budget', 'no') && facts.text.q24_budget_size) {
    add(
      'budget_no_but_size',
      'דווח שאין תקציב שיווק קבוע, אבל נמסר סדר גודל חודשי — לברר מה נכון.',
    );
  }
  // Not open to paid marketing, but a budget is in place.
  if (
    hasValue(facts, 'q26_paid', 'no') &&
    hasValue(facts, 'q23_has_budget', 'yes')
  ) {
    add(
      'paid_no_but_budget',
      'יש תקציב שיווק קבוע אבל סומן «כרגע לא» לשיווק ממומן — לברר לאן התקציב מיועד.',
    );
  }

  // Positioning tension: luxury and cheap are not the same brand.
  if (describe.includes('luxury') && describe.includes('affordable')) {
    add(
      'luxury_vs_affordable',
      'תפיסת מותג: נבחרו גם «יוקרתי» וגם «משתלם» — מיצוב שדורש הכרעה.',
    );
  }
  if (describe.includes('luxury') && describe.includes('folksy')) {
    add(
      'luxury_vs_folksy',
      'תפיסת מותג: נבחרו גם «יוקרתי» וגם «עממי» — מיצוב שדורש הכרעה.',
    );
  }

  // "מבין אלה שבחרת" that isn't one of the picks.
  const top = facts.text.q32_top?.trim();
  if (top && describe.length) {
    const chosenLabels = describe
      .map((v) => labelFromDescribe(v))
      .filter(Boolean);
    if (chosenLabels.length && !chosenLabels.some((l) => top.includes(l))) {
      add(
        'top_trait_not_selected',
        `התכונה החשובה ביותר שנמסרה («${top}») אינה אחת מהתכונות שנבחרו (${chosenLabels.join(', ')}).`,
      );
    }
  }

  // Quality-first positioning against reach-first brand goal.
  if (
    hasValue(facts, 'q33_tradeoff', 'few_big') &&
    hasValue(facts, 'q34_brand', 'reach')
  ) {
    add(
      'few_big_vs_reach',
      'מטרות: «פחות לקוחות, עסקאות גדולות» מול «להגיע לכמה שיותר אנשים» — כיוונים מנוגדים, להכריע לפני בניית התוכנית.',
    );
  }

  // Says nothing blocks growth beyond "I don't know", plus a concrete blocker.
  if (blockers.includes('unknown') && blockers.length > 1) {
    add(
      'blocker_unknown_and_some',
      'חסמי צמיחה: סומן «אני לא יודע» יחד עם חסמים ספציפיים.',
    );
  }

  return out;
}

const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'אינסטגרם',
  facebook: 'פייסבוק',
  tiktok: 'טיקטוק',
};
function labelOf(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

const DESCRIBE_LABELS: Record<string, string> = {
  luxury: 'יוקרתי',
  professional: 'מקצועי',
  quality: 'איכותי',
  reliable: 'אמין',
  innovative: 'חדשני',
  personal: 'אישי',
  creative: 'יצירתי',
  fast: 'מהיר',
  affordable: 'משתלם',
  folksy: 'עממי',
};
function labelFromDescribe(value: string): string {
  return DESCRIBE_LABELS[value] ?? '';
}

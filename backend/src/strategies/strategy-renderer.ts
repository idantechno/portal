/**
 * Deterministic assembly of the strategy markdown.
 *
 * Nothing here calls a model. The drafted strategy arrives already resolved and
 * this file only decides where each field is printed — which is what keeps the
 * "no invention" rule enforceable: a slot with no data prints ⟨לא ידוע⟩ because
 * the renderer says so, not because a prompt asked nicely.
 *
 * Unlike the brief there is a single layer (the whole document is a draft), so
 * instead of per-line 🟠 tags the document carries one banner at the top and
 * reads as a clean strategic doc — matching the sample `marketing-strategy.md`.
 */

import { StrategyDraft, UNKNOWN } from './strategy-drafter.service';

export interface RenderStrategyInput {
  draft: StrategyDraft;
  businessName: string;
  generatedAt: Date;
  model?: string | null;
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** A value, or ⟨לא ידוע⟩ when there's nothing to show. */
function val(v: string): string {
  return v && v.trim() ? v.trim() : UNKNOWN;
}

/** A bullet list, or a single ⟨לא ידוע⟩ line when empty. */
function bullets(items: string[]): string[] {
  if (items.length === 0) return [`- ${UNKNOWN}`];
  return items.map((i) => `- ${i}`);
}

/** Escapes a cell so a literal `|` doesn't break the markdown table. */
function cell(v: string): string {
  return val(v).replace(/\|/g, '\\|');
}

export function renderStrategy(input: RenderStrategyInput): string {
  const { draft } = input;
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  /* ---- Header ---------------------------------------------------------- */
  push(
    `# אסטרטגיית שיווק — ${input.businessName}`,
    '',
    '> נגזרת מהבריף המאושר של העסק.',
    `> נבנתה ${formatDate(input.generatedAt)} · **טיוטה — טעונת אישור** · 🛑 לא לשליחה ללקוח לפני אישור ידני.`,
    `> אופק: ${val(draft.horizon)}`,
    '',
    `> **כלל ברזל:** שדה שאין עליו מידע בבריף כתוב \`${UNKNOWN}\`. אין ניחושים, ואין ציטוט תוצאות/סטטיסטיקות של לקוחות שלא נמסרו.`,
    '',
    '---',
    '',
  );

  /* ---- 0 · Situation --------------------------------------------------- */
  push(
    '## 0 · המצב בשורה אחת',
    '',
    val(draft.situationOneLiner),
    '',
    `**המסקנה שמכתיבה הכול:** ${val(draft.centralConstraint)}`,
    '',
    '---',
    '',
  );

  /* ---- 1 · The central bet --------------------------------------------- */
  push(
    '## 1 · ההימור המרכזי (החלטת המיצוב)',
    '',
    `> ${val(draft.centralBet)}`,
    '',
    '**על מה זה נשען — שטחים פנויים בשוק:**',
    ...bullets(draft.freeGround),
    '',
    `**מדוע דווקא זה ההימור:** ${val(draft.betRationale)}`,
    '',
    `**מה זה אומר בפועל:** ${val(draft.betMeaning)}`,
    '',
    '---',
    '',
  );

  /* ---- 2 · Audience & sequence ----------------------------------------- */
  push('## 2 · קהל ורצף (במי מתמקדים, ובאיזה סדר)', '');
  if (draft.audiences.length === 0) {
    push(`- ${UNKNOWN}`, '');
  } else {
    push(
      '| עדיפות | קהל | למה בסדר הזה |',
      '|---|---|---|',
      ...draft.audiences.map(
        (a) =>
          `| ${cell(a.rank)} | ${cell(a.audience)} | ${cell(a.whyOrder)} |`,
      ),
      '',
    );
  }
  push(`> **החלטה:** ${val(draft.audienceDecision)}`, '', '---', '');

  /* ---- 3 · Funnel ------------------------------------------------------ */
  push(
    '## 3 · המשפך — פתרון המתח',
    '',
    `**המתח:** ${val(draft.funnelTension)}`,
    '',
    '**המבנה:**',
    ...bullets(draft.funnelStages),
    '',
    `**איך זה פותר את המתח:** ${val(draft.funnelResolution)}`,
    '',
    '---',
    '',
  );

  /* ---- 4 · Proof engine ------------------------------------------------ */
  const proofTitle = draft.proofIsBlocker
    ? '## 4 · 🚨 מנוע ההוכחה — העדיפות מספר 1'
    : '## 4 · מנוע ההוכחה';
  push(proofTitle, '');
  if (draft.proofIsBlocker) {
    push(
      '**בלי זה שום דבר אחר לא עובד** — אין הוכחה חברתית, אף קמפיין לא ימיר. זה הצוואר, וזה מקבל את מירב האנרגיה בחודשים הראשונים.',
      '',
    );
  }
  push(
    '**המנגנון:**',
    '',
    val(draft.proofMechanism),
    '',
    '**התנאים (בלעדיהם המנגנון מתפספס):**',
    ...bullets(draft.proofConditions),
    '',
    '**נכסים שכבר קיימים ולא ממונפים:**',
    ...bullets(draft.proofExistingAssets),
    '',
    '---',
    '',
  );

  /* ---- 5 · Channels ---------------------------------------------------- */
  push(
    '## 5 · ערוצים — אורגני קודם, ממומן אחר כך',
    '',
    `**עיקרון:** ${val(draft.channelsPrinciple)}`,
    '',
    '### שלב א׳ — אורגני',
    ...bullets(draft.organicChannels),
    '',
    '### שלב ב׳ — הוספת ממומן',
    `**מתי נכנס:** ${val(draft.paidTrigger)}`,
    '',
    ...bullets(draft.paidChannels),
    '',
    '---',
    '',
  );

  /* ---- 6 · Message pillars --------------------------------------------- */
  push('## 6 · עמודי מסר (מה משדרים בכל מקום)', '');
  if (draft.messagePillars.length === 0) {
    push(`- ${UNKNOWN}`, '');
  } else {
    push(
      '| עמוד תווך | המסר | ⛔ להימנע |',
      '|---|---|---|',
      ...draft.messagePillars.map(
        (p) => `| ${cell(p.pillar)} | ${cell(p.message)} | ${cell(p.avoid)} |`,
      ),
      '',
    );
  }
  push('**⛔ להסיר מיד:**', ...bullets(draft.removeNow), '', '---', '');

  /* ---- 7 · Roadmap ----------------------------------------------------- */
  push('## 7 · מפת הדרך', '');
  if (draft.roadmap.length === 0) {
    push(`- ${UNKNOWN}`, '');
  } else {
    push(
      '| תקופה | מבנה | הכנסה/חודש | המשימה האמיתית |',
      '|---|---|---|---|',
      ...draft.roadmap.map(
        (r) =>
          `| ${cell(r.period)} | ${cell(r.structure)} | ${cell(r.revenue)} | ${cell(r.realTask)} |`,
      ),
      '',
    );
  }
  push(
    `**המנוף לאורך כל הדרך:** ${val(draft.roadmapLever)}`,
    '',
    `> **הערכה כנה:** ${val(draft.honestEstimate)}`,
    '',
    '---',
    '',
  );

  /* ---- 8 · Metrics ----------------------------------------------------- */
  push('## 8 · מה מודדים (ורק את זה)', '');
  if (draft.metrics.length === 0) {
    push(`- ${UNKNOWN}`, '');
  } else {
    push(
      '| מדד | יעד מוקדם | יעד מאוחר |',
      '|---|---|---|',
      ...draft.metrics.map(
        (m) =>
          `| ${cell(m.metric)} | ${cell(m.targetEarly)} | ${cell(m.targetLate)} |`,
      ),
      '',
    );
  }
  push(`> ${val(draft.metricsNote)}`, '', '---', '');

  /* ---- 9 · Red lines --------------------------------------------------- */
  push(
    '## 9 · ⛔ קווים אדומים בשיווק',
    '',
    ...bullets(draft.redLines),
    '',
    '---',
    '',
  );

  /* ---- 10 · First 90 days ---------------------------------------------- */
  push(
    '## 10 · 90 הימים הראשונים — תוכנית קונקרטית',
    '',
    '**חודש 1**',
    ...bullets(draft.month1),
    '',
    '**חודש 2**',
    ...bullets(draft.month2),
    '',
    '**חודש 3**',
    ...bullets(draft.month3),
    '',
    '---',
    '',
  );

  /* ---- 11 · Blocking decisions ----------------------------------------- */
  push(
    '## 11 · ההחלטות שחוסמות ביצוע',
    '',
    ...bullets(draft.blockingDecisions),
    '',
    `<!-- הופק אוטומטית · ${input.generatedAt.toISOString()} · מודל: ${input.model ?? 'n/a'} -->`,
  );

  return out.join('\n');
}

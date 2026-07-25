/**
 * The CLIENT-FACING strategy: the same plan as `renderStrategy`, stripped of the
 * agency's internal working notes — no "draft / 🛑 don't send" banner, no
 * ⟨לא ידוע⟩ gaps (unknown fields are omitted, not shown), no "blocking decisions"
 * section, no candid feasibility caveat ("הערכה כנה"), and no "remove these
 * claims" cleanup list. What's left is a polished deliverable to hand to the
 * client. Deterministic — renders from the stored StrategyDraft, no model call.
 */

import { StrategyDraft } from './strategy-drafter.service';

/**
 * Strips gap-references the drafter sometimes weaves INTO otherwise-good prose —
 * not just whole ⟨לא ידוע⟩ fields but inline notes like "(בסיס לא ידוע)" — and
 * repairs the grammar left behind (e.g. "מ-(בסיס לא ידוע) ל-50" → "ל-50"). Runs
 * on every client export so no deliverable has to be cleaned by hand.
 */
function sanitize(v: string | undefined | null): string {
  let t = (v ?? '').trim();
  if (!t) return '';
  // ⟨…⟩ notes (incl. the ⟨לא ידוע⟩ sentinel), and (…)/[…] fragments that mention לא ידוע.
  t = t.replace(/⟨[^⟨⟩]*⟩/g, '');
  t = t.replace(/[(（][^()（）]*לא ידוע[^()（）]*[)）]/g, '');
  t = t.replace(/\[[^[\]]*לא ידוע[^[\]]*\]/g, '');
  // "from-<removed> to-" reads as just "to-".
  t = t.replace(/מ-\s*ל-/g, 'ל-');
  // Tidy leftovers: collapsed spaces, space-before-punctuation, orphan edges.
  t = t
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:·])/g, '$1')
    .replace(/^[·,;:\s-]+|[·,;:\s-]+$/g, '')
    .trim();
  return t;
}

function has(v: string | undefined | null): boolean {
  return sanitize(v) !== '';
}

function clean(items: string[] | undefined): string[] {
  return (items ?? []).map((s) => sanitize(s)).filter((s) => s !== '');
}

function cell(v: string): string {
  return sanitize(v).replace(/\|/g, '\\|') || '—';
}

function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function renderClientStrategy(
  draft: StrategyDraft,
  businessName: string,
  generatedAt: Date,
): string {
  const out: string[] = [];
  const push = (...l: string[]) => out.push(...l);
  /** Emits a section only when it actually has content. */
  const section = (title: string, body: string[]) => {
    if (body.length === 0) return;
    push(`## ${title}`, '', ...body, '', '---', '');
  };

  push(
    `# אסטרטגיית שיווק — ${businessName}`,
    '',
    `> תוכנית שיווק · ${fmtDate(generatedAt)}`,
    '',
    '---',
    '',
  );

  // המצב
  {
    const b: string[] = [];
    if (has(draft.situationOneLiner)) b.push(sanitize(draft.situationOneLiner));
    if (has(draft.centralConstraint))
      b.push('', `**המסקנה המרכזית:** ${sanitize(draft.centralConstraint)}`);
    section('המצב', b);
  }

  // המיצוב וההימור המרכזי
  {
    const b: string[] = [];
    if (has(draft.centralBet)) b.push(`> ${sanitize(draft.centralBet)}`, '');
    const fg = clean(draft.freeGround);
    if (fg.length) b.push('**על מה זה נשען:**', ...fg.map((x) => `- ${x}`), '');
    if (has(draft.betRationale))
      b.push(`**למה זה נכון:** ${sanitize(draft.betRationale)}`, '');
    if (has(draft.betMeaning))
      b.push(`**מה זה אומר בפועל:** ${sanitize(draft.betMeaning)}`);
    section('המיצוב וההימור המרכזי', b);
  }

  // קהל היעד וסדר העדיפויות
  {
    const b: string[] = [];
    if (draft.audiences?.length) {
      b.push(
        '| עדיפות | קהל | למה בסדר הזה |',
        '|---|---|---|',
        ...draft.audiences.map(
          (a) =>
            `| ${cell(a.rank)} | ${cell(a.audience)} | ${cell(a.whyOrder)} |`,
        ),
        '',
      );
    }
    if (has(draft.audienceDecision))
      b.push(`> **החלטה:** ${sanitize(draft.audienceDecision)}`);
    section('קהל היעד וסדר העדיפויות', b);
  }

  // מסע הלקוח (המשפך)
  {
    const b: string[] = [];
    if (has(draft.funnelTension))
      b.push(`**האתגר:** ${sanitize(draft.funnelTension)}`, '');
    const fs = clean(draft.funnelStages);
    if (fs.length) b.push('**המבנה:**', ...fs.map((x) => `- ${x}`), '');
    if (has(draft.funnelResolution))
      b.push(`**הפתרון:** ${sanitize(draft.funnelResolution)}`);
    section('מסע הלקוח', b);
  }

  // מנוע ההוכחה
  {
    const b: string[] = [];
    if (has(draft.proofMechanism)) b.push(sanitize(draft.proofMechanism), '');
    const pc = clean(draft.proofConditions);
    if (pc.length) b.push('**תנאים להצלחה:**', ...pc.map((x) => `- ${x}`), '');
    const pa = clean(draft.proofExistingAssets);
    if (pa.length)
      b.push('**נכסים קיימים למינוף:**', ...pa.map((x) => `- ${x}`));
    section(
      draft.proofIsBlocker ? 'מנוע ההוכחה — עדיפות ראשונה' : 'מנוע ההוכחה',
      b,
    );
  }

  // ערוצים
  {
    const b: string[] = [];
    if (has(draft.channelsPrinciple))
      b.push(`**עיקרון:** ${sanitize(draft.channelsPrinciple)}`, '');
    const oc = clean(draft.organicChannels);
    if (oc.length) b.push('### אורגני', ...oc.map((x) => `- ${x}`), '');
    const paidBody: string[] = [];
    if (has(draft.paidTrigger))
      paidBody.push(`**מתי נכנס:** ${sanitize(draft.paidTrigger)}`);
    const pch = clean(draft.paidChannels);
    if (pch.length) paidBody.push(...pch.map((x) => `- ${x}`));
    if (paidBody.length) b.push('### ממומן (בהמשך)', ...paidBody);
    section('ערוצים', b);
  }

  // מסרים מרכזיים (keeps the "avoid" guardrails; drops the internal removeNow list)
  {
    const b: string[] = [];
    if (draft.messagePillars?.length) {
      b.push(
        '| עמוד תווך | המסר | להימנע |',
        '|---|---|---|',
        ...draft.messagePillars.map(
          (p) =>
            `| ${cell(p.pillar)} | ${cell(p.message)} | ${cell(p.avoid)} |`,
        ),
      );
    }
    section('מסרים מרכזיים', b);
  }

  // מפת הדרך (drops the candid "הערכה כנה")
  {
    const b: string[] = [];
    if (draft.roadmap?.length) {
      b.push(
        '| תקופה | מבנה | יעד | המשימה המרכזית |',
        '|---|---|---|---|',
        ...draft.roadmap.map(
          (r) =>
            `| ${cell(r.period)} | ${cell(r.structure)} | ${cell(r.revenue)} | ${cell(r.realTask)} |`,
        ),
        '',
      );
    }
    if (has(draft.roadmapLever))
      b.push(`**המנוף לאורך הדרך:** ${sanitize(draft.roadmapLever)}`);
    section('מפת הדרך', b);
  }

  // מדדי הצלחה
  {
    const b: string[] = [];
    if (draft.metrics?.length) {
      b.push(
        '| מדד | יעד מוקדם | יעד מאוחר |',
        '|---|---|---|',
        ...draft.metrics.map(
          (m) =>
            `| ${cell(m.metric)} | ${cell(m.targetEarly)} | ${cell(m.targetLate)} |`,
        ),
        '',
      );
    }
    if (has(draft.metricsNote)) b.push(`> ${sanitize(draft.metricsNote)}`);
    section('מדדי הצלחה', b);
  }

  // קווים אדומים
  {
    const rl = clean(draft.redLines);
    if (rl.length)
      section(
        'קווים אדומים — מה לא עושים',
        rl.map((x) => `- ${x}`),
      );
  }

  // 90 הימים הראשונים
  {
    const b: string[] = [];
    const m1 = clean(draft.month1);
    const m2 = clean(draft.month2);
    const m3 = clean(draft.month3);
    if (m1.length) b.push('**חודש 1**', ...m1.map((x) => `- ${x}`), '');
    if (m2.length) b.push('**חודש 2**', ...m2.map((x) => `- ${x}`), '');
    if (m3.length) b.push('**חודש 3**', ...m3.map((x) => `- ${x}`));
    section('90 הימים הראשונים', b);
  }

  // (section 11 "blocking decisions" intentionally omitted)
  push(`*הוכן על ידי Portal Studio · ${fmtDate(generatedAt)}*`, '');

  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

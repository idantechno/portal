/**
 * The CLIENT-FACING strategy: the same plan as `renderStrategy`, stripped of the
 * agency's internal working notes — no "draft / 🛑 don't send" banner, no
 * ⟨לא ידוע⟩ gaps (unknown fields are omitted, not shown), no "blocking decisions"
 * section, no candid feasibility caveat ("הערכה כנה"), and no "remove these
 * claims" cleanup list. What's left is a polished deliverable to hand to the
 * client. Deterministic — renders from the stored StrategyDraft, no model call.
 */

import { StrategyDraft, UNKNOWN } from './strategy-drafter.service';

function has(v: string | undefined | null): v is string {
  return !!v && v.trim() !== '' && v.trim() !== UNKNOWN;
}

function clean(items: string[] | undefined): string[] {
  return (items ?? [])
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s && s !== UNKNOWN);
}

function cell(v: string): string {
  return (v ?? '').trim().replace(/\|/g, '\\|') || '—';
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
    if (has(draft.situationOneLiner)) b.push(draft.situationOneLiner.trim());
    if (has(draft.centralConstraint))
      b.push('', `**המסקנה המרכזית:** ${draft.centralConstraint.trim()}`);
    section('המצב', b);
  }

  // המיצוב וההימור המרכזי
  {
    const b: string[] = [];
    if (has(draft.centralBet)) b.push(`> ${draft.centralBet.trim()}`, '');
    const fg = clean(draft.freeGround);
    if (fg.length) b.push('**על מה זה נשען:**', ...fg.map((x) => `- ${x}`), '');
    if (has(draft.betRationale))
      b.push(`**למה זה נכון:** ${draft.betRationale.trim()}`, '');
    if (has(draft.betMeaning))
      b.push(`**מה זה אומר בפועל:** ${draft.betMeaning.trim()}`);
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
      b.push(`> **החלטה:** ${draft.audienceDecision.trim()}`);
    section('קהל היעד וסדר העדיפויות', b);
  }

  // מסע הלקוח (המשפך)
  {
    const b: string[] = [];
    if (has(draft.funnelTension))
      b.push(`**האתגר:** ${draft.funnelTension.trim()}`, '');
    const fs = clean(draft.funnelStages);
    if (fs.length) b.push('**המבנה:**', ...fs.map((x) => `- ${x}`), '');
    if (has(draft.funnelResolution))
      b.push(`**הפתרון:** ${draft.funnelResolution.trim()}`);
    section('מסע הלקוח', b);
  }

  // מנוע ההוכחה
  {
    const b: string[] = [];
    if (has(draft.proofMechanism)) b.push(draft.proofMechanism.trim(), '');
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
      b.push(`**עיקרון:** ${draft.channelsPrinciple.trim()}`, '');
    const oc = clean(draft.organicChannels);
    if (oc.length) b.push('### אורגני', ...oc.map((x) => `- ${x}`), '');
    const paidBody: string[] = [];
    if (has(draft.paidTrigger))
      paidBody.push(`**מתי נכנס:** ${draft.paidTrigger.trim()}`);
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
      b.push(`**המנוף לאורך הדרך:** ${draft.roadmapLever.trim()}`);
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
    if (has(draft.metricsNote)) b.push(`> ${draft.metricsNote.trim()}`);
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

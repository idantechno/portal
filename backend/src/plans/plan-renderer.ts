/**
 * Deterministic assembly of the plan markdown — no model calls here. The drafted
 * plan arrives already resolved and this file only decides where each field is
 * printed, which is what keeps the "no invention" rule enforceable: an empty
 * slot prints ⟨לא ידוע⟩ because the renderer says so.
 */

import { PlanDraft, UNKNOWN } from './plan-drafter.service';

export interface RenderPlanInput {
  draft: PlanDraft;
  businessName: string;
  generatedAt: Date;
  model?: string | null;
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function val(v: string): string {
  return v && v.trim() ? v.trim() : UNKNOWN;
}

function bullets(items: string[]): string[] {
  if (items.length === 0) return [`- ${UNKNOWN}`];
  return items.map((i) => `- ${i}`);
}

function cell(v: string): string {
  return val(v).replace(/\|/g, '\\|');
}

export function renderPlan(input: RenderPlanInput): string {
  const { draft } = input;
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  /* ---- Header ---------------------------------------------------------- */
  push(
    `# תוכנית עבודה — ${input.businessName}`,
    '',
    '> נגזרת מאסטרטגיית השיווק המאושרת של העסק.',
    `> נבנתה ${formatDate(input.generatedAt)} · **טיוטה — טעונת אישור** · 🛑 לא לשליחה ללקוח לפני אישור ידני.`,
    `> אופק: ${val(draft.horizon)}`,
    '',
    `> **כלל ברזל:** שדה שאין עליו מידע באסטרטגיה כתוב \`${UNKNOWN}\`. אין ניחושים ואין תאריכים/מספרים שלא נגזרים מהאסטרטגיה.`,
    '',
    '---',
    '',
  );

  /* ---- 0 · Focus & objective ------------------------------------------- */
  push(
    '## 0 · המוקד והיעד',
    '',
    val(draft.focus),
    '',
    `**היעד שהתוכנית משרתת:** ${val(draft.objective)}`,
    '',
    '---',
    '',
  );

  /* ---- 1 · Immediate actions ------------------------------------------- */
  push(
    '## 1 · מה עושים כבר השבוע',
    '',
    ...bullets(draft.immediateActions),
    '',
    '---',
    '',
  );

  /* ---- 2 · Workstreams ------------------------------------------------- */
  push('## 2 · תחומי העבודה', '');
  if (draft.workstreams.length === 0) {
    push(`- ${UNKNOWN}`, '');
  } else {
    for (const w of draft.workstreams) {
      push(
        `### ${val(w.name)}`,
        `**המטרה:** ${val(w.goal)}`,
        '',
        ...bullets(w.tasks),
        '',
      );
    }
  }
  push('---', '');

  /* ---- 3 · Timeline ---------------------------------------------------- */
  push('## 3 · ציר הזמן', '');
  if (draft.timeline.length === 0) {
    push(`- ${UNKNOWN}`, '');
  } else {
    for (const t of draft.timeline) {
      push(`### ${val(t.period)} — ${val(t.focus)}`, ...bullets(t.tasks), '');
    }
  }
  push('---', '');

  /* ---- 4 · Milestones -------------------------------------------------- */
  push('## 4 · אבני דרך', '');
  if (draft.milestones.length === 0) {
    push(`- ${UNKNOWN}`, '');
  } else {
    push(
      '| תקופה | אבן דרך | הושלם כאשר |',
      '|---|---|---|',
      ...draft.milestones.map(
        (m) =>
          `| ${cell(m.period)} | ${cell(m.milestone)} | ${cell(m.doneWhen)} |`,
      ),
      '',
    );
  }
  push('---', '');

  /* ---- 5 · Dependencies ------------------------------------------------ */
  push(
    '## 5 · תלויות והחלטות חוסמות',
    '',
    ...bullets(draft.dependencies),
    '',
    '---',
    '',
  );

  /* ---- 6 · Risks ------------------------------------------------------- */
  push('## 6 · סיכונים', '', ...bullets(draft.risks), '', '---', '');

  /* ---- 7 · Metrics ----------------------------------------------------- */
  push('## 7 · מדדי הצלחה', '');
  if (draft.metrics.length === 0) {
    push(`- ${UNKNOWN}`, '');
  } else {
    push(
      '| מדד | יעד |',
      '|---|---|',
      ...draft.metrics.map((m) => `| ${cell(m.metric)} | ${cell(m.target)} |`),
      '',
    );
  }
  push(
    `<!-- הופק אוטומטית · ${input.generatedAt.toISOString()} · מודל: ${input.model ?? 'n/a'} -->`,
  );

  return out.join('\n');
}

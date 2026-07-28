import { ObjectiveDraft, UNKNOWN } from './objective-drafter.service';

export interface RenderObjectiveInput {
  draft: ObjectiveDraft;
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

/** Deterministic assembly of the goals-&-objectives markdown — no model call. */
export function renderObjective(input: RenderObjectiveInput): string {
  const { draft } = input;
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  push(
    `# יעדים ומטרות — ${input.businessName}`,
    '',
    '> נגזר מהבריף המאושר של העסק, לאישור הלקוח.',
    `> נבנה ${formatDate(input.generatedAt)} · **טיוטה — טעונת אישור הלקוח**`,
    '',
    '---',
    '',
  );

  push('## 1 · מטרות הקמפיין', '', ...bullets(draft.goals), '', '---', '');

  push('## 2 · מדדי הצלחה', '');
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
  push('---', '');

  push('## 3 · קהל יעד', '', val(draft.audience), '');
  if (draft.audienceSegments.length > 0) {
    push('**פילוחים:**', ...bullets(draft.audienceSegments), '');
  }

  push(
    `<!-- הופק אוטומטית · ${input.generatedAt.toISOString()} · מודל: ${input.model ?? 'n/a'} -->`,
  );

  return out.join('\n');
}

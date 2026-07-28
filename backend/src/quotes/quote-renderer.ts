import { Quote } from './quote.entity';

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * Deterministic markdown for a marketing quote — a clean, client-facing
 * document assembled from the operator-filled structured fields. No model call.
 */
export function renderQuote(quote: Quote): string {
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  push(
    `# הצעת מחיר — ${quote.title}`,
    '',
    `> נערכה ${formatDate(quote.updatedAt ?? quote.createdAt ?? new Date())}${
      quote.status === 'approved' ? ' · **מאושרת**' : ' · טיוטה'
    }`,
    '',
    '---',
    '',
  );

  /* Section 1 — customer journey */
  push(
    '## מסלול הלקוח',
    '',
    quote.journey.trim() || '⟨לא הוזן⟩',
    '',
    '---',
    '',
  );

  /* Section 2 — marketing channels */
  push('## ערוצי שיווק', '');
  if (!quote.channels || quote.channels.length === 0) {
    push('⟨לא הוזנו ערוצים⟩', '');
  } else {
    push('| ערוץ | מה נעשה | תקציב |', '|---|---|---|');
    for (const c of quote.channels) {
      const cell = (v: string) => (v || '—').replace(/\|/g, '\\|');
      push(`| ${cell(c.name)} | ${cell(c.description)} | ${cell(c.budget)} |`);
    }
    push('');
  }
  push('---', '');

  /* Section 3 — budget */
  push('## תקציב', '', quote.budgetSummary.trim() || '⟨לא הוזן⟩', '');
  if (quote.total?.trim()) {
    push(`**סה״כ:** ${quote.total.trim()}`, '');
  }

  if (quote.notes?.trim()) {
    push('---', '', '## הערות', '', quote.notes.trim(), '');
  }

  return out.join('\n');
}

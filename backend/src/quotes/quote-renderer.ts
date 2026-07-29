import { Quote } from './quote.entity';

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const cell = (v: string) => (v || '—').replace(/\|/g, '\\|');

/** The business-agnostic body: scope + priced line items + total. */
function renderFlexible(quote: Quote, out: string[]): void {
  const push = (...lines: string[]) => out.push(...lines);

  if (quote.intro.trim()) {
    push('## היקף העבודה', '', quote.intro.trim(), '', '---', '');
  }

  push('## פירוט', '');
  if (!quote.lineItems || quote.lineItems.length === 0) {
    push('⟨לא הוזנו פריטים⟩', '');
  } else {
    push('| פריט | תיאור | מחיר |', '|---|---|---|');
    for (const it of quote.lineItems) {
      push(
        `| ${cell(it.name)} | ${cell(it.description)} | ${cell(it.amount)} |`,
      );
    }
    push('');
  }

  if (quote.total?.trim()) {
    push(`**סה״כ:** ${quote.total.trim()}`, '');
  }

  if (quote.notes?.trim()) {
    push('---', '', '## תנאים', '', quote.notes.trim(), '');
  }
}

/** Legacy marketing body — kept so older marketing quotes still render. */
function renderLegacyMarketing(quote: Quote, out: string[]): void {
  const push = (...lines: string[]) => out.push(...lines);

  push(
    '## מסלול הלקוח',
    '',
    quote.journey.trim() || '⟨לא הוזן⟩',
    '',
    '---',
    '',
  );

  push('## ערוצי שיווק', '');
  if (!quote.channels || quote.channels.length === 0) {
    push('⟨לא הוזנו ערוצים⟩', '');
  } else {
    push('| ערוץ | מה נעשה | תקציב |', '|---|---|---|');
    for (const c of quote.channels) {
      push(`| ${cell(c.name)} | ${cell(c.description)} | ${cell(c.budget)} |`);
    }
    push('');
  }
  push('---', '');

  push('## תקציב', '', quote.budgetSummary.trim() || '⟨לא הוזן⟩', '');
  if (quote.total?.trim()) {
    push(`**סה״כ:** ${quote.total.trim()}`, '');
  }
  if (quote.notes?.trim()) {
    push('---', '', '## הערות', '', quote.notes.trim(), '');
  }
}

/**
 * Deterministic markdown for a quote — a clean, client-facing document
 * assembled from the operator-filled structured fields. No model call.
 *
 * Prefers the flexible, business-tailored structure (scope + line items). Only
 * a quote with neither an intro nor line items — an older marketing quote —
 * falls back to the legacy journey/channels/budget sections.
 */
export function renderQuote(quote: Quote): string {
  const out: string[] = [];
  out.push(
    `# הצעת מחיר — ${quote.title}`,
    '',
    `> נערכה ${formatDate(quote.updatedAt ?? quote.createdAt ?? new Date())}${
      quote.status === 'approved' ? ' · **מאושרת**' : ' · טיוטה'
    }`,
    '',
    '---',
    '',
  );

  const hasFlexible =
    (quote.lineItems?.length ?? 0) > 0 || quote.intro.trim().length > 0;
  if (hasFlexible) {
    renderFlexible(quote, out);
  } else {
    renderLegacyMarketing(quote, out);
  }

  return out.join('\n');
}

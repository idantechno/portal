import { Business } from '../businesses/business.entity';
import { Quote } from './quote.entity';

/**
 * Renders a branded, print-ready HTML quote ("הצעת מחיר") for a single business.
 * A TRUSTED template — every user string is HTML-escaped and the result is
 * rendered through `PdfRendererService.renderHtmlToPdf`. RTL Hebrew, Rubik body +
 * Frank Ruhl Libre display, A4, and — the point of this file — a modern, clean,
 * premium look driven by `business.branding` (colors + logo): a thin brand
 * gradient rule, generous whitespace, an elegant title block, and a refined
 * line-items table. Designed to read like a studio that leads on design.
 */

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "#rrggbb" / "#rgb" → "r, g, b" for building translucent brand tints. */
function hexToRgb(hex: string, fallback = '30, 42, 74'): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3)
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function safeLogoUrl(logoUrl?: string): string | null {
  if (!logoUrl) return null;
  const url = logoUrl.trim();
  if (url.startsWith('data:') || /^https?:\/\//i.test(url)) return url;
  return null;
}

/**
 * Scope text: a single paragraph stays a paragraph, but a multi-line block
 * (the common case — a list of deliverables) becomes a clean checklist with
 * brand-coloured markers, so it reads as intentional rather than dumped text.
 */
function renderScope(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2 && lines.every((l) => l.length <= 140)) {
    return `<ul class="scope-list">${lines
      .map((l) => `<li>${esc(l)}</li>`)
      .join('')}</ul>`;
  }
  return lines.map((l) => `<p>${esc(l)}</p>`).join('\n');
}

function paragraphs(text: string): string {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join('\n');
}

export function renderQuoteHtml(quote: Quote, business: Business): string {
  const branding = business.branding ?? {};
  const primary = branding.primaryColor?.trim() || '#1e2a4a';
  const secondary = branding.secondaryColor?.trim() || primary;
  const accent = branding.accentColor?.trim() || '#ff6b5c';
  const primaryRgb = hexToRgb(primary);
  const logoUrl = safeLogoUrl(branding.logoUrl);
  const slogan = branding.slogan?.trim();

  const dateSource = quote.updatedAt ?? new Date();
  const dateFormatted = new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateSource);
  const approved = quote.status === 'approved';
  const statusLabel = approved ? 'מאושרת' : 'טיוטה';

  const introHtml =
    quote.intro && quote.intro.trim()
      ? `<section class="section">
        <div class="eyebrow">היקף העבודה</div>
        <div class="body-text">${renderScope(quote.intro)}</div>
      </section>`
      : '';

  const rows = (quote.lineItems ?? [])
    .filter((item) => item && (item.name || item.description || item.amount))
    .map(
      (item) => `<tr>
        <td class="cell-name">${esc(item.name ?? '')}</td>
        <td class="cell-desc">${esc(item.description ?? '')}</td>
        <td class="cell-amount">${esc(item.amount ?? '') || '—'}</td>
      </tr>`,
    )
    .join('\n');

  const itemsSection = rows
    ? `<section class="section">
        <div class="eyebrow">פירוט</div>
        <div class="table-wrap">
          <table class="items">
            <thead>
              <tr><th>פריט</th><th>תיאור</th><th class="th-amount">מחיר</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`
    : '';

  const totalHtml =
    quote.total && quote.total.trim()
      ? `<div class="total-row">
        <div class="total-card">
          <span class="total-label">סה״כ</span>
          <span class="total-value">${esc(quote.total)}</span>
        </div>
      </div>`
      : '';

  const notesHtml =
    quote.notes && quote.notes.trim()
      ? `<section class="section notes">
        <div class="eyebrow">תנאים והערות</div>
        <div class="body-text">${paragraphs(quote.notes)}</div>
      </section>`
      : '';

  const brandMark = logoUrl
    ? `<img src="${esc(logoUrl)}" class="logo" alt="${esc(business.name)}" />`
    : `<div class="wordmark">${esc(business.name)}</div>`;

  const sloganHtml = slogan ? `<div class="slogan">${esc(slogan)}</div>` : '';

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>הצעת מחיר — ${esc(quote.title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&family=Frank+Ruhl+Libre:wght@500;700&display=swap');

    :root {
      --primary: ${esc(primary)};
      --secondary: ${esc(secondary)};
      --accent: ${esc(accent)};
      --primary-rgb: ${primaryRgb};
      --ink: #20242e;
      --muted: #8a91a0;
      --line: #edeff3;
      --tint: rgba(var(--primary-rgb), 0.05);
      --tint-strong: rgba(var(--primary-rgb), 0.10);
    }

    * { box-sizing: border-box; }

    @page { margin: 0; }

    body {
      font-family: 'Rubik', 'Heebo', Arial, sans-serif;
      margin: 0;
      color: var(--ink);
      background: #fff;
      line-height: 1.7;
      font-size: 14px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Thin brand gradient rule across the very top — the tech-forward touch. */
    .brand-bar {
      height: 5px;
      background: linear-gradient(90deg, var(--primary), var(--accent));
    }

    .page { padding: 44px 52px 40px; }

    /* Header: logo / wordmark on the start side, date on the end side. */
    .doc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 40px;
    }
    .logo { max-height: 52px; max-width: 210px; display: block; }
    .wordmark {
      font-family: 'Frank Ruhl Libre', 'Rubik', Georgia, serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--primary);
      letter-spacing: -0.01em;
    }
    .slogan { font-size: 11.5px; color: var(--muted); margin-top: 3px; }
    .header-date { text-align: left; font-size: 11.5px; color: var(--muted); }

    /* Title block. */
    .title-block { margin-bottom: 36px; }
    .eyebrow {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.16em;
      color: var(--accent);
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    h1 {
      font-family: 'Frank Ruhl Libre', 'Rubik', Georgia, serif;
      font-size: 32px;
      line-height: 1.15;
      font-weight: 700;
      letter-spacing: -0.015em;
      margin: 0;
      color: var(--primary);
    }
    .pill {
      display: inline-block;
      margin-top: 12px;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 999px;
      background: var(--tint-strong);
      color: var(--primary);
    }
    .pill.approved { background: rgba(16, 122, 92, 0.12); color: #0d7a5c; }

    .section { margin-bottom: 30px; }
    .section .eyebrow { color: var(--muted); }
    .body-text p { margin: 0 0 8px; color: #414755; }
    .body-text p:last-child { margin-bottom: 0; }

    /* Scope checklist. */
    .scope-list { list-style: none; margin: 0; padding: 0; }
    .scope-list li {
      position: relative;
      padding-inline-start: 22px;
      margin-bottom: 9px;
      color: #414755;
    }
    .scope-list li::before {
      content: "";
      position: absolute;
      inline-size: 7px;
      block-size: 7px;
      inset-inline-start: 3px;
      top: 10px;
      border-radius: 2px;
      background: var(--accent);
    }

    /* Line-items table — hairline separators, tinted header, rounded frame. */
    .table-wrap {
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    table.items { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    table.items thead th {
      background: var(--tint);
      color: var(--primary);
      text-align: right;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.04em;
      padding: 13px 16px;
      border-bottom: 1px solid var(--line);
    }
    table.items thead th.th-amount { text-align: left; }
    table.items tbody td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    table.items tbody tr:last-child td { border-bottom: none; }
    table.items tbody tr { break-inside: avoid; }
    .cell-name { font-weight: 600; color: var(--ink); white-space: nowrap; }
    .cell-desc { color: #6b7280; }
    .cell-amount {
      text-align: left;
      white-space: nowrap;
      font-weight: 600;
      color: var(--ink);
      font-variant-numeric: tabular-nums;
    }

    /* Total — a refined brand card aligned to the start side. */
    .total-row { display: flex; justify-content: flex-start; margin: 6px 0 34px; }
    .total-card {
      display: inline-flex;
      align-items: baseline;
      gap: 16px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #fff;
      border-radius: 12px;
      padding: 16px 24px;
      break-inside: avoid;
      min-width: 200px;
      justify-content: space-between;
    }
    .total-card .total-label { font-size: 13px; font-weight: 500; opacity: 0.85; }
    .total-card .total-value {
      font-size: 22px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .notes .body-text p { color: var(--muted); font-size: 12.5px; }

    .doc-footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: var(--muted);
    }
    .doc-footer .mark { color: var(--primary); font-weight: 600; }
  </style>
</head>
<body>
  <div class="brand-bar"></div>
  <div class="page">
    <header class="doc-header">
      <div class="brand">
        ${brandMark}
        ${sloganHtml}
      </div>
      <div class="header-date">${esc(dateFormatted)}</div>
    </header>

    <div class="title-block">
      <div class="eyebrow">הצעת מחיר</div>
      <h1>${esc(quote.title)}</h1>
      <span class="pill${approved ? ' approved' : ''}">${statusLabel}</span>
    </div>

    ${introHtml}
    ${itemsSection}
    ${totalHtml}
    ${notesHtml}

    <div class="doc-footer">
      <span class="mark">${esc(business.name)}</span>
      <span>נערך ב-${esc(dateFormatted)}</span>
    </div>
  </div>
</body>
</html>`;
}

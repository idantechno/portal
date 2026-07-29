import { Business } from '../businesses/business.entity';
import { Quote } from './quote.entity';

/**
 * Renders a branded, print-ready HTML quote ("הצעת מחיר") for a single business.
 * This is a TRUSTED template — every user-supplied string is HTML-escaped and the
 * result is rendered through `PdfRendererService.renderHtmlToPdf` (the controlled
 * path). It mirrors the work-order template's style: RTL Hebrew, Rubik body +
 * Frank Ruhl Libre headings, A4-friendly, driven by `business.branding`.
 */

/** HTML-escapes a user-supplied string so it can't break out of the markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Splits free text into escaped <p> paragraphs, dropping empty lines. */
function paragraphs(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${esc(line)}</p>`)
    .join('\n');
}

/** Only emit a logo when the URL is a data URI or absolute http(s) URL. */
function safeLogoUrl(logoUrl?: string): string | null {
  if (!logoUrl) return null;
  const url = logoUrl.trim();
  if (url.startsWith('data:') || /^https?:\/\//i.test(url)) return url;
  return null;
}

export function renderQuoteHtml(quote: Quote, business: Business): string {
  const branding = business.branding ?? {};
  const primary = branding.primaryColor?.trim() || '#1e2a4a';
  const accent = branding.accentColor?.trim() || '#ff6b5c';
  const logoUrl = safeLogoUrl(branding.logoUrl);
  const slogan = branding.slogan?.trim();

  const dateSource = quote.updatedAt ?? new Date();
  const dateFormatted = new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateSource);
  const statusLabel = quote.status === 'approved' ? 'מאושרת' : 'טיוטה';

  const introHtml =
    quote.intro && quote.intro.trim()
      ? `<section class="section">
        <h2>היקף העבודה</h2>
        <div class="body-text">${paragraphs(quote.intro)}</div>
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
  const itemsBody = rows
    ? rows
    : `<tr><td class="cell-empty" colspan="3">—</td></tr>`;

  const totalHtml =
    quote.total && quote.total.trim()
      ? `<div class="total-band">
        <span class="total-label">סה״כ</span>
        <span class="total-value">${esc(quote.total)}</span>
      </div>`
      : '';

  const notesHtml =
    quote.notes && quote.notes.trim()
      ? `<section class="section">
        <h2>תנאים והערות</h2>
        <div class="body-text">${paragraphs(quote.notes)}</div>
      </section>`
      : '';

  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" class="logo" alt="${esc(business.name)}" />`
    : '<div></div>';

  const sloganHtml = slogan ? `<div class="slogan">${esc(slogan)}</div>` : '';

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>הצעת מחיר — ${esc(quote.title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=Frank+Ruhl+Libre:wght@500;700&display=swap');

    :root {
      --primary: ${esc(primary)};
      --accent: ${esc(accent)};
      --ink: #1a1a1a;
      --muted: #6b6b6b;
      --line: #e5e5e5;
      --bg-tint: #fafafa;
    }

    * { box-sizing: border-box; }

    body {
      font-family: 'Rubik', 'Heebo', Arial, sans-serif;
      margin: 0;
      padding: 40px 48px;
      color: var(--ink);
      background: white;
      line-height: 1.6;
      font-size: 14px;
    }

    .doc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 24px;
      border-bottom: 2px solid var(--primary);
      margin-bottom: 32px;
    }
    .logo { max-height: 56px; max-width: 200px; }
    .doc-header-meta { text-align: left; color: var(--muted); font-size: 12px; }
    .doc-header-meta .business-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 4px;
    }
    .doc-header-meta .slogan { font-size: 12px; color: var(--muted); }

    h1 {
      font-family: 'Frank Ruhl Libre', 'Rubik', Georgia, serif;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin: 0 0 8px;
      color: var(--primary);
    }

    .doc-subline {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 28px;
    }
    .doc-subline .status {
      color: var(--accent);
      font-weight: 600;
    }

    .section { margin-bottom: 24px; }
    .section h2 {
      font-family: 'Frank Ruhl Libre', 'Rubik', Georgia, serif;
      font-size: 16px;
      font-weight: 700;
      color: var(--primary);
      padding-bottom: 8px;
      border-bottom: 1px solid var(--line);
      margin: 0 0 12px;
    }
    .body-text p { margin: 0 0 8px; }
    .body-text p:last-child { margin-bottom: 0; }

    table.items {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    table.items thead th {
      background: var(--primary);
      color: white;
      text-align: right;
      font-weight: 600;
      padding: 10px 12px;
    }
    table.items thead th:last-child { text-align: left; }
    table.items tbody td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    table.items tbody tr:nth-child(even) { background: var(--bg-tint); }
    .cell-name { font-weight: 600; white-space: nowrap; }
    .cell-desc { color: var(--muted); }
    .cell-amount { text-align: left; white-space: nowrap; font-weight: 600; }
    .cell-empty { text-align: center; color: var(--muted); }

    .total-band {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--primary);
      color: white;
      border-radius: 8px;
      padding: 14px 20px;
      margin: 20px 0 24px;
    }
    .total-band .total-label { font-size: 14px; font-weight: 500; }
    .total-band .total-value {
      font-size: 20px;
      font-weight: 700;
      border-bottom: 3px solid var(--accent);
      padding-bottom: 2px;
    }

    .doc-footer {
      margin-top: 56px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      font-size: 11px;
      color: var(--muted);
      text-align: center;
    }
  </style>
</head>
<body>
  <header class="doc-header">
    ${logoHtml}
    <div class="doc-header-meta">
      <div class="business-name">${esc(business.name)}</div>
      ${sloganHtml}
    </div>
  </header>

  <h1>הצעת מחיר — ${esc(quote.title)}</h1>
  <div class="doc-subline">
    ${esc(dateFormatted)} · <span class="status">${statusLabel}</span>
  </div>

  ${introHtml}

  <section class="section">
    <h2>פירוט</h2>
    <table class="items">
      <thead>
        <tr>
          <th>פריט</th>
          <th>תיאור</th>
          <th>מחיר</th>
        </tr>
      </thead>
      <tbody>
        ${itemsBody}
      </tbody>
    </table>
  </section>

  ${totalHtml}

  ${notesHtml}

  <div class="doc-footer">
    ${esc(business.name)} · נערך ב-${esc(dateFormatted)}
  </div>
</body>
</html>`;
}

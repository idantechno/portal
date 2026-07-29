import { Business } from '../businesses/business.entity';
import { Quote, QuoteLineItem } from './quote.entity';

/**
 * Branded, print-ready HTML for a quote ("הצעת מחיר") — in one of several fixed
 * DESIGNS the operator picks per quote (`quote.template`). Each design has its
 * own subtle ARTISTIC signature (a faded geometric texture, a burnt-exposure
 * glow, an abstract shape field, a single brush stroke, a halftone print
 * texture) rendered inline — self-contained, print-safe, and tinted from the
 * business's own colours. TRUSTED template: user strings are HTML-escaped and
 * the result is rendered through `PdfRendererService.renderHtmlToPdf`.
 */

export type QuoteTemplate =
  | 'classic'
  | 'sidebar'
  | 'bold'
  | 'minimal'
  | 'editorial';

export const QUOTE_TEMPLATE_KEYS: QuoteTemplate[] = [
  'classic',
  'sidebar',
  'bold',
  'minimal',
  'editorial',
];

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&family=Frank+Ruhl+Libre:wght@500;700&display=swap');`;

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hexToRgb(hex: string, fallback = '30, 42, 74'): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function safeLogoUrl(logoUrl?: string): string | null {
  if (!logoUrl) return null;
  const url = logoUrl.trim();
  if (url.startsWith('data:') || /^https?:\/\//i.test(url)) return url;
  return null;
}

interface QuoteData {
  primary: string;
  secondary: string;
  accent: string;
  primaryRgb: string;
  accentRgb: string;
  logoUrl: string | null;
  slogan: string;
  name: string;
  title: string;
  dateFormatted: string;
  approved: boolean;
  statusLabel: string;
  intro: string;
  items: QuoteLineItem[];
  total: string;
  notes: string;
}

function buildData(quote: Quote, business: Business): QuoteData {
  const b = business.branding ?? {};
  const primary = b.primaryColor?.trim() || '#1e2a4a';
  const accent = b.accentColor?.trim() || '#ff6b5c';
  return {
    primary,
    secondary: b.secondaryColor?.trim() || primary,
    accent,
    primaryRgb: hexToRgb(primary),
    accentRgb: hexToRgb(accent, '255, 107, 92'),
    logoUrl: safeLogoUrl(b.logoUrl),
    slogan: b.slogan?.trim() || '',
    name: business.name,
    title: quote.title,
    dateFormatted: new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(quote.updatedAt ?? new Date()),
    approved: quote.status === 'approved',
    statusLabel: quote.status === 'approved' ? 'מאושרת' : 'טיוטה',
    intro: quote.intro?.trim() || '',
    items: (quote.lineItems ?? []).filter(
      (i) => i && (i.name || i.description || i.amount),
    ),
    total: quote.total?.trim() || '',
    notes: quote.notes?.trim() || '',
  };
}

function scopeHtml(text: string, listClass = 'scope-list'): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2 && lines.every((l) => l.length <= 140)) {
    return `<ul class="${listClass}">${lines
      .map((l) => `<li>${esc(l)}</li>`)
      .join('')}</ul>`;
  }
  return lines.map((l) => `<p>${esc(l)}</p>`).join('\n');
}

function paragraphsHtml(text: string): string {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join('\n');
}

function itemRows(items: QuoteLineItem[]): string {
  return items
    .map(
      (it) => `<tr>
        <td class="c-name">${esc(it.name ?? '')}</td>
        <td class="c-desc">${esc(it.description ?? '')}</td>
        <td class="c-amount">${esc(it.amount ?? '') || '—'}</td>
      </tr>`,
    )
    .join('\n');
}

function brandMark(d: QuoteData, cls = 'logo'): string {
  return d.logoUrl
    ? `<img src="${esc(d.logoUrl)}" class="${cls}" alt="${esc(d.name)}" />`
    : `<div class="wordmark">${esc(d.name)}</div>`;
}

/** An organic single-swipe brush-stroke path (used by the minimal design). */
const BRUSH_PATH =
  'M6,40 C70,25 96,53 158,39 C214,27 250,51 300,37 C342,26 372,45 396,33 ' +
  'C372,53 346,41 300,50 C250,60 214,45 158,55 C94,67 58,42 6,40 Z';

function doc(title: string, css: string, body: string): string {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    ${FONTS}
    * { box-sizing: border-box; }
    @page { margin: 0; }
    body {
      margin: 0; background: #fff; color: #20242e;
      font-family: 'Rubik', 'Heebo', Arial, sans-serif;
      line-height: 1.7; font-size: 14px;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .wordmark { font-family: 'Frank Ruhl Libre', Georgia, serif; font-weight: 700; }
    .art { position: absolute; pointer-events: none; }
    ${css}
  </style>
</head>
<body>${body}</body>
</html>`;
}

/* ── 1. CLASSIC — clean, with a faded concentric-ring geometry ─────────────── */
function tplClassic(d: QuoteData): string {
  const css = `
    :root { --p:${d.primary}; --s:${d.secondary}; --a:${d.accent}; --prgb:${d.primaryRgb}; --argb:${d.accentRgb}; }
    .sheet { position:relative; overflow:hidden; min-height:297mm; }
    .bar { height:5px; background:linear-gradient(90deg,var(--p),var(--a)); position:relative; z-index:2; }
    /* ART: faint concentric rings top-start + a soft accent bloom */
    .art-rings { top:-150px; inset-inline-start:-150px; width:420px; height:420px; opacity:.05; z-index:0; }
    .art-bloom { top:60px; inset-inline-end:-120px; width:300px; height:300px; z-index:0;
      background:radial-gradient(circle, rgba(var(--argb),.14), transparent 62%); }
    .page { position:relative; z-index:1; padding:44px 52px 40px; }
    .hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:40px; }
    .logo { max-height:52px; max-width:210px; display:block; } .wordmark { font-size:22px; color:var(--p); }
    .slogan { font-size:11.5px; color:#8a91a0; margin-top:3px; }
    .hd-date { font-size:11.5px; color:#8a91a0; text-align:left; }
    .eyebrow { font-size:10.5px; font-weight:600; letter-spacing:.16em; color:var(--a); text-transform:uppercase; margin-bottom:10px; }
    h1 { font-family:'Frank Ruhl Libre',serif; font-size:32px; line-height:1.15; font-weight:700; margin:0; color:var(--p); }
    .pill { display:inline-block; margin-top:12px; font-size:11px; font-weight:600; padding:4px 12px; border-radius:999px; background:rgba(var(--prgb),.10); color:var(--p); }
    .sec { margin:30px 0; } .sec .eyebrow { color:#8a91a0; }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { position:relative; padding-inline-start:22px; margin-bottom:9px; color:#414755; }
    .scope-list li::before { content:""; position:absolute; width:7px; height:7px; inset-inline-start:3px; top:10px; border-radius:2px; background:var(--a); }
    .twrap { border:1px solid #edeff3; border-radius:12px; overflow:hidden; background:#fff; }
    table { width:100%; border-collapse:collapse; font-size:13.5px; }
    thead th { background:rgba(var(--prgb),.05); color:var(--p); text-align:right; font-size:11px; letter-spacing:.04em; font-weight:600; padding:13px 16px; border-bottom:1px solid #edeff3; }
    thead th.c-amount { text-align:left; }
    tbody td { padding:14px 16px; border-bottom:1px solid #edeff3; vertical-align:top; }
    tbody tr:last-child td { border-bottom:none; }
    .c-name { font-weight:600; white-space:nowrap; } .c-desc { color:#6b7280; } .c-amount { text-align:left; font-weight:600; white-space:nowrap; }
    .total-row { display:flex; margin:6px 0 34px; }
    .total { display:inline-flex; gap:16px; justify-content:space-between; min-width:200px; background:linear-gradient(135deg,var(--p),var(--s)); color:#fff; border-radius:12px; padding:16px 24px; }
    .total .l { font-size:13px; opacity:.85; } .total .v { font-size:22px; font-weight:700; }
    .notes p { color:#8a91a0; font-size:12.5px; }
    .ft { margin-top:48px; padding-top:16px; border-top:1px solid #edeff3; display:flex; justify-content:space-between; font-size:10.5px; color:#8a91a0; }
    .ft .m { color:var(--p); font-weight:600; }`;
  const rings = `<svg class="art art-rings" viewBox="0 0 200 200" fill="none" stroke="${esc(d.primary)}" stroke-width="1.1">
    <circle cx="100" cy="100" r="40"/><circle cx="100" cy="100" r="62"/><circle cx="100" cy="100" r="84"/><circle cx="100" cy="100" r="20"/></svg>`;
  const body = `<div class="sheet">
    <div class="bar"></div>
    ${rings}<div class="art art-bloom"></div>
    <div class="page">
      <div class="hd"><div>${brandMark(d)}${d.slogan ? `<div class="slogan">${esc(d.slogan)}</div>` : ''}</div><div class="hd-date">${esc(d.dateFormatted)}</div></div>
      <div class="eyebrow">הצעת מחיר</div><h1>${esc(d.title)}</h1><span class="pill">${d.statusLabel}</span>
      ${d.intro ? `<div class="sec"><div class="eyebrow">היקף העבודה</div>${scopeHtml(d.intro)}</div>` : ''}
      ${d.items.length ? `<div class="sec"><div class="eyebrow">פירוט</div><div class="twrap"><table><thead><tr><th>פריט</th><th>תיאור</th><th class="c-amount">מחיר</th></tr></thead><tbody>${itemRows(d.items)}</tbody></table></div></div>` : ''}
      ${d.total ? `<div class="total-row"><div class="total"><span class="l">סה״כ</span><span class="v">${esc(d.total)}</span></div></div>` : ''}
      ${d.notes ? `<div class="sec notes"><div class="eyebrow">תנאים והערות</div>${paragraphsHtml(d.notes)}</div>` : ''}
      <div class="ft"><span class="m">${esc(d.name)}</span><span>נערך ב-${esc(d.dateFormatted)}</span></div>
    </div>
  </div>`;
  return doc(`הצעת מחיר — ${d.title}`, css, body);
}

/* ── 2. SIDEBAR — brand column with a burnt-exposure glow + geometry ───────── */
function tplSidebar(d: QuoteData): string {
  const css = `
    :root { --p:${d.primary}; --s:${d.secondary}; --a:${d.accent}; --prgb:${d.primaryRgb}; }
    .wrap { display:flex; min-height:297mm; }
    .aside { position:relative; overflow:hidden; width:34%; background:linear-gradient(165deg,var(--p),var(--s)); color:#fff; padding:40px 28px; display:flex; flex-direction:column; }
    /* ART: overexposed light bloom top + faint geometric ring bottom + hairlines */
    .aside::before { content:""; position:absolute; top:-80px; inset-inline-start:-40px; width:280px; height:280px; border-radius:50%;
      background:radial-gradient(circle, rgba(255,255,255,.30), transparent 60%); }
    .aside::after { content:""; position:absolute; bottom:-90px; inset-inline-end:-70px; width:240px; height:240px; border-radius:50%;
      border:1px solid rgba(255,255,255,.22); }
    .aside > * { position:relative; z-index:1; }
    .aside .logo { max-height:46px; max-width:150px; filter:brightness(0) invert(1); margin-bottom:auto; }
    .aside .wordmark { font-size:20px; color:#fff; margin-bottom:auto; }
    .aside .slogan { font-size:11px; opacity:.82; margin-top:6px; }
    .a-meta { margin-top:28px; font-size:12px; opacity:.85; } .a-meta div { margin-bottom:6px; }
    .a-total { margin-top:22px; padding-top:18px; border-top:1px solid rgba(255,255,255,.25); }
    .a-total .l { font-size:12px; opacity:.75; } .a-total .v { font-size:24px; font-weight:700; margin-top:4px; }
    .main { flex:1; padding:44px 44px 40px; position:relative; }
    .eyebrow { font-size:10.5px; font-weight:600; letter-spacing:.16em; color:var(--a); text-transform:uppercase; margin-bottom:8px; }
    h1 { font-family:'Frank Ruhl Libre',serif; font-size:28px; line-height:1.2; margin:0 0 28px; color:var(--p); }
    .sec { margin-bottom:28px; } .sec .eyebrow { color:#a2a8b4; }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { position:relative; padding-inline-start:20px; margin-bottom:9px; color:#414755; }
    .scope-list li::before { content:""; position:absolute; width:6px; height:6px; inset-inline-start:2px; top:10px; border-radius:50%; background:var(--a); }
    table { width:100%; border-collapse:collapse; font-size:13.5px; }
    thead th { text-align:right; color:var(--p); font-size:11px; letter-spacing:.04em; font-weight:600; padding:0 4px 10px; border-bottom:2px solid var(--p); }
    thead th.c-amount { text-align:left; }
    tbody td { padding:13px 4px; border-bottom:1px solid #edeff3; vertical-align:top; }
    .c-name { font-weight:600; } .c-desc { color:#6b7280; } .c-amount { text-align:left; font-weight:600; white-space:nowrap; }
    .notes p { color:#8a91a0; font-size:12.5px; }`;
  const body = `<div class="wrap">
    <aside class="aside">
      ${brandMark(d)}${d.slogan ? `<div class="slogan">${esc(d.slogan)}</div>` : ''}
      <div class="a-meta"><div>תאריך: ${esc(d.dateFormatted)}</div><div>סטטוס: ${d.statusLabel}</div></div>
      ${d.total ? `<div class="a-total"><div class="l">סה״כ</div><div class="v">${esc(d.total)}</div></div>` : ''}
    </aside>
    <main class="main">
      <div class="eyebrow">הצעת מחיר</div><h1>${esc(d.title)}</h1>
      ${d.intro ? `<div class="sec"><div class="eyebrow">היקף העבודה</div>${scopeHtml(d.intro)}</div>` : ''}
      ${d.items.length ? `<div class="sec"><div class="eyebrow">פירוט</div><table><thead><tr><th>פריט</th><th>תיאור</th><th class="c-amount">מחיר</th></tr></thead><tbody>${itemRows(d.items)}</tbody></table></div>` : ''}
      ${d.notes ? `<div class="sec notes"><div class="eyebrow">תנאים והערות</div>${paragraphsHtml(d.notes)}</div>` : ''}
    </main>
  </div>`;
  return doc(`הצעת מחיר — ${d.title}`, css, body);
}

/* ── 3. BOLD — abstract shape field with burnt highlights in the header ────── */
function tplBold(d: QuoteData): string {
  const css = `
    :root { --p:${d.primary}; --s:${d.secondary}; --a:${d.accent}; --prgb:${d.primaryRgb}; --argb:${d.accentRgb}; }
    .head { position:relative; overflow:hidden; background:linear-gradient(120deg,var(--p),var(--s)); color:#fff; padding:40px 52px 46px; }
    /* ART: overlapping translucent blobs + an overexposed white highlight */
    .head .blob { position:absolute; border-radius:50%; filter:blur(2px); }
    .head .b1 { width:230px; height:230px; top:-70px; inset-inline-end:8%; background:rgba(var(--argb),.30); }
    .head .b2 { width:150px; height:150px; bottom:-60px; inset-inline-end:26%; background:rgba(255,255,255,.10); }
    .head .b3 { width:120px; height:120px; top:20px; inset-inline-start:-30px; border:1.5px solid rgba(255,255,255,.20); background:transparent; filter:none; }
    .head .glow { position:absolute; inset:0; background:radial-gradient(circle at 82% 8%, rgba(255,255,255,.35), transparent 42%); }
    .head > .c { position:relative; z-index:1; }
    .head-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:26px; }
    .head .logo { max-height:44px; max-width:170px; filter:brightness(0) invert(1); }
    .head .wordmark { font-size:19px; color:#fff; }
    .head .date { font-size:12px; opacity:.85; }
    .head .eyebrow { font-size:11px; font-weight:600; letter-spacing:.18em; text-transform:uppercase; opacity:.82; margin-bottom:8px; }
    .head h1 { font-family:'Frank Ruhl Libre',serif; font-size:34px; line-height:1.12; margin:0; color:#fff; }
    .page { padding:36px 52px 40px; }
    .eyebrow2 { font-size:10.5px; font-weight:600; letter-spacing:.16em; color:var(--a); text-transform:uppercase; margin-bottom:8px; }
    .sec { margin-bottom:28px; }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { position:relative; padding-inline-start:22px; margin-bottom:9px; color:#414755; }
    .scope-list li::before { content:""; position:absolute; width:8px; height:8px; inset-inline-start:2px; top:9px; border-radius:2px; background:var(--a); }
    table { width:100%; border-collapse:collapse; font-size:13.5px; }
    thead th { background:var(--p); color:#fff; text-align:right; font-size:11px; letter-spacing:.04em; font-weight:600; padding:12px 16px; }
    thead th.c-amount { text-align:left; }
    tbody td { padding:13px 16px; border-bottom:1px solid #edeff3; vertical-align:top; }
    .c-name { font-weight:600; } .c-desc { color:#6b7280; } .c-amount { text-align:left; font-weight:600; white-space:nowrap; }
    .total-row { display:flex; justify-content:flex-start; align-items:baseline; gap:14px; margin:22px 0 30px; padding:16px 20px; border:2px solid var(--p); border-radius:12px; }
    .total-row .l { font-size:13px; color:#6b7280; } .total-row .v { font-size:26px; font-weight:700; color:var(--p); }
    .notes p { color:#8a91a0; font-size:12.5px; }
    .ft { padding:0 52px 34px; font-size:10.5px; color:#8a91a0; } .ft .m { color:var(--p); font-weight:600; }`;
  const body = `<div class="head">
      <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span><span class="glow"></span>
      <div class="c">
        <div class="head-top">${brandMark(d)}<div class="date">${esc(d.dateFormatted)} · ${d.statusLabel}</div></div>
        <div class="eyebrow">הצעת מחיר</div><h1>${esc(d.title)}</h1>
      </div>
    </div>
    <div class="page">
      ${d.intro ? `<div class="sec"><div class="eyebrow2">היקף העבודה</div>${scopeHtml(d.intro)}</div>` : ''}
      ${d.items.length ? `<div class="sec"><div class="eyebrow2">פירוט</div><table><thead><tr><th>פריט</th><th>תיאור</th><th class="c-amount">מחיר</th></tr></thead><tbody>${itemRows(d.items)}</tbody></table></div>` : ''}
      ${d.total ? `<div class="total-row"><span class="l">סה״כ לתשלום</span><span class="v">${esc(d.total)}</span></div>` : ''}
      ${d.notes ? `<div class="sec notes"><div class="eyebrow2">תנאים והערות</div>${paragraphsHtml(d.notes)}</div>` : ''}
    </div>
    <div class="ft"><span class="m">${esc(d.name)}</span> · נערך ב-${esc(d.dateFormatted)}</div>`;
  return doc(`הצעת מחיר — ${d.title}`, css, body);
}

/* ── 4. MINIMAL — airy, with one artistic brush stroke ─────────────────────── */
function tplMinimal(d: QuoteData): string {
  const css = `
    :root { --p:${d.primary}; --a:${d.accent}; }
    .sheet { position:relative; overflow:hidden; min-height:297mm; }
    .page { position:relative; z-index:1; padding:64px 64px 56px; max-width:720px; }
    .hd { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:52px; }
    .logo { max-height:38px; max-width:150px; } .wordmark { font-size:16px; color:var(--p); }
    .hd-date { font-size:11px; color:#9aa0ab; text-align:left; }
    .title-wrap { position:relative; margin-bottom:40px; }
    /* ART: a single organic brush stroke behind the eyebrow/title */
    .brush { position:absolute; top:-6px; inset-inline-start:-14px; width:230px; height:52px; opacity:.16; z-index:0; }
    .eyebrow { position:relative; z-index:1; font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:#9aa0ab; margin-bottom:14px; }
    h1 { position:relative; z-index:1; font-size:30px; font-weight:400; letter-spacing:-.01em; margin:0; color:#20242e; }
    .sec { margin-bottom:40px; }
    .sec-label { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#9aa0ab; margin-bottom:14px; }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { padding-bottom:10px; margin-bottom:10px; border-bottom:1px solid #f1f2f5; color:#3f4552; }
    .scope-list li:last-child { border-bottom:none; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    thead th { text-align:right; font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:#9aa0ab; font-weight:500; padding:0 0 12px; }
    thead th.c-amount { text-align:left; }
    tbody td { padding:15px 0; border-top:1px solid #f1f2f5; vertical-align:top; }
    .c-name { font-weight:600; } .c-desc { color:#8a91a0; } .c-amount { text-align:left; font-weight:600; white-space:nowrap; }
    .total-row { display:flex; justify-content:space-between; align-items:baseline; margin:34px 0; padding-top:18px; border-top:2px solid var(--p); }
    .total-row .l { font-size:13px; color:#9aa0ab; letter-spacing:.06em; } .total-row .v { font-size:24px; font-weight:600; color:var(--p); }
    .notes p { color:#9aa0ab; font-size:12.5px; }
    .ft { margin-top:56px; font-size:10.5px; color:#b6bcc6; }`;
  const brush = `<svg class="brush" viewBox="0 0 400 80" preserveAspectRatio="none"><path d="${BRUSH_PATH}" fill="${esc(d.accent)}"/></svg>`;
  const body = `<div class="sheet"><div class="page">
    <div class="hd"><div>${brandMark(d)}</div><div class="hd-date">${esc(d.dateFormatted)}<br>${d.statusLabel}</div></div>
    <div class="title-wrap">${brush}<div class="eyebrow">הצעת מחיר</div><h1>${esc(d.title)}</h1></div>
    ${d.intro ? `<div class="sec"><div class="sec-label">היקף העבודה</div>${scopeHtml(d.intro)}</div>` : ''}
    ${d.items.length ? `<div class="sec"><div class="sec-label">פירוט</div><table><thead><tr><th>פריט</th><th>תיאור</th><th class="c-amount">מחיר</th></tr></thead><tbody>${itemRows(d.items)}</tbody></table></div>` : ''}
    ${d.total ? `<div class="total-row"><span class="l">סה״כ</span><span class="v">${esc(d.total)}</span></div>` : ''}
    ${d.notes ? `<div class="sec notes"><div class="sec-label">תנאים והערות</div>${paragraphsHtml(d.notes)}</div>` : ''}
    <div class="ft">${esc(d.name)}</div>
  </div></div>`;
  return doc(`הצעת מחיר — ${d.title}`, css, body);
}

/* ── 5. EDITORIAL — serif, with a halftone print texture + drop glyph ──────── */
function tplEditorial(d: QuoteData): string {
  const dot = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><circle cx='2' cy='2' r='1.4' fill='${d.primary}'/></svg>`,
  );
  const css = `
    :root { --p:${d.primary}; --a:${d.accent}; --prgb:${d.primaryRgb}; }
    .sheet { position:relative; overflow:hidden; min-height:297mm; }
    /* ART: a halftone dot field fading out from the top-start corner + a giant faint quote glyph */
    .art-dots { top:0; inset-inline-start:0; width:340px; height:300px; opacity:.10; z-index:0;
      background-image:url("data:image/svg+xml,${dot}"); background-size:14px 14px;
      -webkit-mask-image:radial-gradient(circle at 0 0, #000, transparent 72%);
      mask-image:radial-gradient(circle at 0 0, #000, transparent 72%); }
    .art-glyph { top:170px; inset-inline-end:24px; font-family:'Frank Ruhl Libre',serif; font-size:280px; line-height:1;
      color:var(--p); opacity:.045; z-index:0; }
    .page { position:relative; z-index:1; padding:52px 60px 44px; }
    .hd { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; border-bottom:1px solid #e7e3da; margin-bottom:8px; }
    .logo { max-height:48px; max-width:190px; } .wordmark { font-size:21px; color:var(--p); }
    .hd .kicker { font-family:'Frank Ruhl Libre',serif; font-style:italic; font-size:14px; color:var(--a); }
    .rule2 { height:3px; border-top:1px solid var(--p); border-bottom:1px solid var(--p); margin-bottom:34px; }
    .eyebrow { font-family:'Frank Ruhl Libre',serif; font-style:italic; font-size:15px; color:var(--a); margin-bottom:6px; }
    h1 { font-family:'Frank Ruhl Libre',serif; font-size:40px; line-height:1.1; font-weight:700; margin:0 0 10px; color:var(--p); }
    .meta { font-size:12px; color:#8a7f6e; margin-bottom:36px; }
    .sec { margin-bottom:30px; }
    .sec h2 { font-family:'Frank Ruhl Libre',serif; font-size:19px; color:var(--p); margin:0 0 12px; padding-bottom:8px; border-bottom:1px solid #ece7dd; }
    .body p { color:#4a4740; margin:0 0 8px; }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { position:relative; padding-inline-start:20px; margin-bottom:9px; color:#4a4740; }
    .scope-list li::before { content:"—"; position:absolute; inset-inline-start:0; color:var(--a); }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    thead th { text-align:right; font-family:'Frank Ruhl Libre',serif; font-size:13px; color:var(--p); font-weight:700; padding:0 6px 10px; border-bottom:2px solid var(--p); }
    thead th.c-amount { text-align:left; }
    tbody td { padding:14px 6px; border-bottom:1px solid #ece7dd; vertical-align:top; }
    .c-name { font-weight:600; color:#332f28; } .c-desc { color:#7a7264; } .c-amount { text-align:left; font-weight:700; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .total-row { display:flex; justify-content:space-between; align-items:baseline; margin:24px 0 32px; padding:16px 22px; background:rgba(var(--prgb),.05); border-radius:2px; border-inline-start:3px solid var(--a); }
    .total-row .l { font-family:'Frank Ruhl Libre',serif; font-size:15px; color:var(--p); } .total-row .v { font-size:24px; font-weight:700; color:var(--p); }
    .notes p { color:#8a7f6e; font-size:12.5px; }
    .ft { margin-top:44px; padding-top:14px; border-top:1px solid #e7e3da; text-align:center; font-family:'Frank Ruhl Libre',serif; font-style:italic; font-size:12px; color:#8a7f6e; }`;
  const body = `<div class="sheet">
    <div class="art art-dots"></div><div class="art art-glyph">״</div>
    <div class="page">
      <div class="hd"><div>${brandMark(d)}</div><div class="kicker">${esc(d.name)}</div></div>
      <div class="rule2"></div>
      <div class="eyebrow">הצעת מחיר</div><h1>${esc(d.title)}</h1>
      <div class="meta">${esc(d.dateFormatted)} · ${d.statusLabel}</div>
      ${d.intro ? `<div class="sec"><h2>היקף העבודה</h2><div class="body">${scopeHtml(d.intro)}</div></div>` : ''}
      ${d.items.length ? `<div class="sec"><h2>פירוט</h2><table><thead><tr><th>פריט</th><th>תיאור</th><th class="c-amount">מחיר</th></tr></thead><tbody>${itemRows(d.items)}</tbody></table></div>` : ''}
      ${d.total ? `<div class="total-row"><span class="l">סה״כ</span><span class="v">${esc(d.total)}</span></div>` : ''}
      ${d.notes ? `<div class="sec notes"><h2>תנאים והערות</h2><div class="body">${paragraphsHtml(d.notes)}</div></div>` : ''}
      <div class="ft">${esc(d.name)} · נערך ב-${esc(d.dateFormatted)}</div>
    </div>
  </div>`;
  return doc(`הצעת מחיר — ${d.title}`, css, body);
}

const RENDERERS: Record<QuoteTemplate, (d: QuoteData) => string> = {
  classic: tplClassic,
  sidebar: tplSidebar,
  bold: tplBold,
  minimal: tplMinimal,
  editorial: tplEditorial,
};

export function renderQuoteHtml(quote: Quote, business: Business): string {
  const key = (quote.template ?? 'classic') as QuoteTemplate;
  const render = RENDERERS[key] ?? tplClassic;
  return render(buildData(quote, business));
}

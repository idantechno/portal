import { Business } from '../businesses/business.entity';
import { Quote, QuoteLineItem } from './quote.entity';

/**
 * Branded, print-ready HTML for a quote ("הצעת מחיר") — in one of several fixed
 * DESIGNS the operator picks per quote (`quote.template`).
 *
 * The logo must read as FLOATING, never as a framed sticker. So it always sits
 * directly on an area whose colour is the logo's OWN background
 * (`branding.logoBgColor`, auto-detected on upload) — its edges then dissolve
 * into that area. Two strategies:
 *  - option 2 (default, most designs): the WHOLE document background is the
 *    logo's bg colour, and the logo floats on the page.
 *  - option 3 (two designs): the page is white, but a design element (a side
 *    band / a top strip) is filled with the logo's bg colour and the logo
 *    floats on that element — for logos whose background is too strong to wash
 *    the whole page in.
 * TRUSTED template: user strings are HTML-escaped; rendered via
 * `PdfRendererService.renderHtmlToPdf`.
 */

export type QuoteTemplate =
  | 'classic'
  | 'bold'
  | 'minimal'
  | 'editorial'
  | 'emblem'
  | 'sidebar'
  | 'strip';

export const QUOTE_TEMPLATE_KEYS: QuoteTemplate[] = [
  'classic',
  'bold',
  'minimal',
  'editorial',
  'emblem',
  'sidebar',
  'strip',
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

function rgbOf(
  hex: string,
  fallback: [number, number, number],
): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToRgb(hex: string, fallback = '30, 42, 74'): string {
  const fb = fallback.split(',').map((s) => Number(s.trim())) as [
    number,
    number,
    number,
  ];
  const [r, g, b] = rgbOf(hex, fb);
  return `${r}, ${g}, ${b}`;
}

/** WCAG-ish relative luminance of a hex colour, 0 (black) … 1 (white). */
function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex, [255, 255, 255]).map((c) => c / 255);
  const ch = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Dark or light ink — whichever reads on the given background colour. */
function ink(hex: string): string {
  return luminance(hex) > 0.55 ? '#20242e' : '#ffffff';
}
function muted(hex: string): string {
  return luminance(hex) > 0.55 ? 'rgba(32,36,46,.55)' : 'rgba(255,255,255,.68)';
}
function hairline(hex: string): string {
  return luminance(hex) > 0.55 ? 'rgba(32,36,46,.12)' : 'rgba(255,255,255,.20)';
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
  logoBg: string;
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
    logoBg: b.logoBgColor?.trim() || '#ffffff',
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

function scopeHtml(text: string): string {
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

/** The bare logo <img> — placed DIRECTLY on a logo-colour area (no frame). */
function logoImg(d: QuoteData): string {
  return `<img src="${esc(d.logoUrl ?? '')}" class="logo" alt="${esc(d.name)}" />`;
}

/** Logo (floating) or a wordmark, for placement on a logo-colour area. */
function brandMark(d: QuoteData): string {
  return d.logoUrl ? logoImg(d) : `<div class="wordmark">${esc(d.name)}</div>`;
}

const BRUSH_PATH =
  'M6,40 C70,25 96,53 158,39 C214,27 250,51 300,37 C342,26 372,45 396,33 ' +
  'C372,53 346,41 300,50 C250,60 214,45 158,55 C94,67 58,42 6,40 Z';

function doc(
  title: string,
  css: string,
  body: string,
  bodyBg = '#ffffff',
): string {
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
      margin: 0; background: ${esc(bodyBg)}; color: ${ink(bodyBg)};
      font-family: 'Rubik', 'Heebo', Arial, sans-serif;
      line-height: 1.7; font-size: 14px;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .wordmark { font-family: 'Frank Ruhl Libre', Georgia, serif; font-weight: 700; }
    .logo { display: block; }
    .art { position: absolute; pointer-events: none; }
    ${css}
  </style>
</head>
<body>${body}</body>
</html>`;
}

/* ═══ OPTION 2 — page background IS the logo's own colour; logo floats ═══════ */

/* 1. CLASSIC — brand rule + faded ring geometry, on the logo-colour page. */
function tplClassic(d: QuoteData): string {
  const bg = d.logoBg;
  const css = `
    :root { --p:${d.primary}; --s:${d.secondary}; --a:${d.accent}; --prgb:${d.primaryRgb}; --argb:${d.accentRgb};
      --ink:${ink(bg)}; --muted:${muted(bg)}; --line:${hairline(bg)}; }
    .sheet { position:relative; overflow:hidden; min-height:297mm; }
    .bar { height:5px; background:linear-gradient(90deg,var(--p),var(--a)); position:relative; z-index:2; }
    .art-rings { top:-150px; inset-inline-start:-150px; width:420px; height:420px; opacity:.06; z-index:0; }
    .art-bloom { top:60px; inset-inline-end:-120px; width:300px; height:300px; z-index:0; background:radial-gradient(circle, rgba(var(--argb),.14), transparent 62%); }
    .page { position:relative; z-index:1; padding:44px 52px 40px; }
    .hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:40px; }
    .logo { max-height:56px; max-width:210px; } .wordmark { font-size:22px; color:var(--p); }
    .slogan { font-size:11.5px; color:var(--muted); margin-top:6px; }
    .hd-date { font-size:11.5px; color:var(--muted); text-align:left; }
    .eyebrow { font-size:10.5px; font-weight:600; letter-spacing:.16em; color:var(--a); text-transform:uppercase; margin-bottom:10px; }
    h1 { font-family:'Frank Ruhl Libre',serif; font-size:32px; line-height:1.15; margin:0; color:var(--p); }
    .pill { display:inline-block; margin-top:12px; font-size:11px; font-weight:600; padding:4px 12px; border-radius:999px; background:rgba(var(--prgb),.10); color:var(--p); }
    .sec { margin:30px 0; } .sec .eyebrow { color:var(--muted); }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { position:relative; padding-inline-start:22px; margin-bottom:9px; color:var(--ink); }
    .scope-list li::before { content:""; position:absolute; width:7px; height:7px; inset-inline-start:3px; top:10px; border-radius:2px; background:var(--a); }
    table { width:100%; border-collapse:collapse; font-size:13.5px; }
    thead th { color:var(--p); text-align:right; font-size:11px; letter-spacing:.04em; font-weight:600; padding:0 4px 12px; border-bottom:2px solid var(--p); }
    thead th.c-amount { text-align:left; }
    tbody td { padding:14px 4px; border-bottom:1px solid var(--line); vertical-align:top; }
    .c-name { font-weight:600; white-space:nowrap; color:var(--ink); } .c-desc { color:var(--muted); } .c-amount { text-align:left; font-weight:600; white-space:nowrap; color:var(--ink); }
    .total-row { display:flex; margin:20px 0 34px; }
    .total { display:inline-flex; gap:16px; justify-content:space-between; min-width:200px; background:linear-gradient(135deg,var(--p),var(--s)); color:#fff; border-radius:12px; padding:16px 24px; }
    .total .l { font-size:13px; opacity:.85; } .total .v { font-size:22px; font-weight:700; }
    .notes p { color:var(--muted); font-size:12.5px; }
    .ft { margin-top:48px; padding-top:16px; border-top:1px solid var(--line); display:flex; justify-content:space-between; font-size:10.5px; color:var(--muted); } .ft .m { color:var(--p); font-weight:600; }`;
  const rings = `<svg class="art art-rings" viewBox="0 0 200 200" fill="none" stroke="${esc(d.primary)}" stroke-width="1.1"><circle cx="100" cy="100" r="40"/><circle cx="100" cy="100" r="62"/><circle cx="100" cy="100" r="84"/><circle cx="100" cy="100" r="20"/></svg>`;
  const body = `<div class="sheet">
    <div class="bar"></div>${rings}<div class="art art-bloom"></div>
    <div class="page">
      <div class="hd"><div>${brandMark(d)}${d.slogan ? `<div class="slogan">${esc(d.slogan)}</div>` : ''}</div><div class="hd-date">${esc(d.dateFormatted)}</div></div>
      <div class="eyebrow">הצעת מחיר</div><h1>${esc(d.title)}</h1><span class="pill">${d.statusLabel}</span>
      ${d.intro ? `<div class="sec"><div class="eyebrow">היקף העבודה</div>${scopeHtml(d.intro)}</div>` : ''}
      ${d.items.length ? `<div class="sec"><div class="eyebrow">פירוט</div><table><thead><tr><th>פריט</th><th>תיאור</th><th class="c-amount">מחיר</th></tr></thead><tbody>${itemRows(d.items)}</tbody></table></div>` : ''}
      ${d.total ? `<div class="total-row"><div class="total"><span class="l">סה״כ</span><span class="v">${esc(d.total)}</span></div></div>` : ''}
      ${d.notes ? `<div class="sec notes"><div class="eyebrow">תנאים והערות</div>${paragraphsHtml(d.notes)}</div>` : ''}
      <div class="ft"><span class="m">${esc(d.name)}</span><span>נערך ב-${esc(d.dateFormatted)}</span></div>
    </div>
  </div>`;
  return doc(`הצעת מחיר — ${d.title}`, css, body, bg);
}

/* 2. BOLD — logo floats on the page, then a dramatic brand title band. */
function tplBold(d: QuoteData): string {
  const bg = d.logoBg;
  const css = `
    :root { --p:${d.primary}; --s:${d.secondary}; --a:${d.accent}; --prgb:${d.primaryRgb}; --argb:${d.accentRgb};
      --ink:${ink(bg)}; --muted:${muted(bg)}; --line:${hairline(bg)}; }
    .top { padding:34px 52px 22px; display:flex; align-items:center; justify-content:space-between; }
    .top .logo { max-height:48px; max-width:190px; } .top .wordmark { font-size:20px; color:var(--p); }
    .top .date { font-size:12px; color:var(--muted); }
    .band { position:relative; overflow:hidden; background:linear-gradient(120deg,var(--p),var(--s)); color:#fff; padding:30px 52px 34px; }
    .band .blob { position:absolute; border-radius:50%; filter:blur(2px); }
    .band .b1 { width:220px; height:220px; top:-80px; inset-inline-end:10%; background:rgba(var(--argb),.32); }
    .band .b2 { width:130px; height:130px; bottom:-50px; inset-inline-end:30%; background:rgba(255,255,255,.10); }
    .band .glow { position:absolute; inset:0; background:radial-gradient(circle at 84% 6%, rgba(255,255,255,.34), transparent 44%); }
    .band > .c { position:relative; z-index:1; }
    .band .eyebrow { font-size:11px; font-weight:600; letter-spacing:.18em; text-transform:uppercase; opacity:.82; margin-bottom:8px; }
    .band h1 { font-family:'Frank Ruhl Libre',serif; font-size:34px; line-height:1.12; margin:0; color:#fff; }
    .page { padding:34px 52px 40px; }
    .eyebrow2 { font-size:10.5px; font-weight:600; letter-spacing:.16em; color:var(--a); text-transform:uppercase; margin-bottom:8px; }
    .sec { margin-bottom:28px; }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { position:relative; padding-inline-start:22px; margin-bottom:9px; color:var(--ink); }
    .scope-list li::before { content:""; position:absolute; width:8px; height:8px; inset-inline-start:2px; top:9px; border-radius:2px; background:var(--a); }
    table { width:100%; border-collapse:collapse; font-size:13.5px; }
    thead th { color:var(--p); text-align:right; font-size:11px; letter-spacing:.04em; font-weight:600; padding:0 4px 12px; border-bottom:2px solid var(--p); }
    thead th.c-amount { text-align:left; }
    tbody td { padding:13px 4px; border-bottom:1px solid var(--line); vertical-align:top; }
    .c-name { font-weight:600; color:var(--ink); } .c-desc { color:var(--muted); } .c-amount { text-align:left; font-weight:600; white-space:nowrap; color:var(--ink); }
    .total-row { display:flex; justify-content:flex-start; align-items:baseline; gap:14px; margin:22px 0 30px; padding:16px 20px; border:2px solid var(--p); border-radius:12px; }
    .total-row .l { font-size:13px; color:var(--muted); } .total-row .v { font-size:26px; font-weight:700; color:var(--p); }
    .notes p { color:var(--muted); font-size:12.5px; }
    .ft { padding:0 52px 34px; font-size:10.5px; color:var(--muted); } .ft .m { color:var(--p); font-weight:600; }`;
  const body = `<div class="top"><div>${brandMark(d)}</div><div class="date">${esc(d.dateFormatted)} · ${d.statusLabel}</div></div>
    <div class="band"><span class="blob b1"></span><span class="blob b2"></span><span class="glow"></span>
      <div class="c"><div class="eyebrow">הצעת מחיר</div><h1>${esc(d.title)}</h1></div>
    </div>
    <div class="page">
      ${d.intro ? `<div class="sec"><div class="eyebrow2">היקף העבודה</div>${scopeHtml(d.intro)}</div>` : ''}
      ${d.items.length ? `<div class="sec"><div class="eyebrow2">פירוט</div><table><thead><tr><th>פריט</th><th>תיאור</th><th class="c-amount">מחיר</th></tr></thead><tbody>${itemRows(d.items)}</tbody></table></div>` : ''}
      ${d.total ? `<div class="total-row"><span class="l">סה״כ לתשלום</span><span class="v">${esc(d.total)}</span></div>` : ''}
      ${d.notes ? `<div class="sec notes"><div class="eyebrow2">תנאים והערות</div>${paragraphsHtml(d.notes)}</div>` : ''}
    </div>
    <div class="ft"><span class="m">${esc(d.name)}</span> · נערך ב-${esc(d.dateFormatted)}</div>`;
  return doc(`הצעת מחיר — ${d.title}`, css, body, bg);
}

/* 3. MINIMAL — airy page, one brush stroke, logo floats. */
function tplMinimal(d: QuoteData): string {
  const bg = d.logoBg;
  const css = `
    :root { --p:${d.primary}; --a:${d.accent}; --ink:${ink(bg)}; --muted:${muted(bg)}; --line:${hairline(bg)}; }
    .sheet { position:relative; overflow:hidden; min-height:297mm; }
    .page { position:relative; z-index:1; padding:64px 64px 56px; max-width:720px; }
    .hd { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:52px; }
    .logo { max-height:40px; max-width:150px; } .wordmark { font-size:16px; color:var(--p); }
    .hd-date { font-size:11px; color:var(--muted); text-align:left; }
    .title-wrap { position:relative; margin-bottom:40px; }
    .brush { position:absolute; top:-6px; inset-inline-start:-14px; width:230px; height:52px; opacity:.16; z-index:0; }
    .eyebrow { position:relative; z-index:1; font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:var(--muted); margin-bottom:14px; }
    h1 { position:relative; z-index:1; font-size:30px; font-weight:400; letter-spacing:-.01em; margin:0; color:var(--ink); }
    .sec { margin-bottom:40px; }
    .sec-label { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin-bottom:14px; }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { padding-bottom:10px; margin-bottom:10px; border-bottom:1px solid var(--line); color:var(--ink); }
    .scope-list li:last-child { border-bottom:none; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    thead th { text-align:right; font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); font-weight:500; padding:0 0 12px; }
    thead th.c-amount { text-align:left; }
    tbody td { padding:15px 0; border-top:1px solid var(--line); vertical-align:top; }
    .c-name { font-weight:600; color:var(--ink); } .c-desc { color:var(--muted); } .c-amount { text-align:left; font-weight:600; white-space:nowrap; color:var(--ink); }
    .total-row { display:flex; justify-content:space-between; align-items:baseline; margin:34px 0; padding-top:18px; border-top:2px solid var(--p); }
    .total-row .l { font-size:13px; color:var(--muted); letter-spacing:.06em; } .total-row .v { font-size:24px; font-weight:600; color:var(--p); }
    .notes p { color:var(--muted); font-size:12.5px; }
    .ft { margin-top:56px; font-size:10.5px; color:var(--muted); }`;
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
  return doc(`הצעת מחיר — ${d.title}`, css, body, bg);
}

/* 4. EDITORIAL — serif, halftone texture, logo floats. */
function tplEditorial(d: QuoteData): string {
  const bg = d.logoBg;
  const dot = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><circle cx='2' cy='2' r='1.4' fill='${d.primary}'/></svg>`,
  );
  const css = `
    :root { --p:${d.primary}; --a:${d.accent}; --prgb:${d.primaryRgb}; --ink:${ink(bg)}; --muted:${muted(bg)}; --line:${hairline(bg)}; }
    .sheet { position:relative; overflow:hidden; min-height:297mm; }
    .art-dots { top:0; inset-inline-start:0; width:340px; height:300px; opacity:.10; z-index:0; background-image:url("data:image/svg+xml,${dot}"); background-size:14px 14px; -webkit-mask-image:radial-gradient(circle at 0 0, #000, transparent 72%); mask-image:radial-gradient(circle at 0 0, #000, transparent 72%); }
    .art-glyph { top:170px; inset-inline-end:24px; font-family:'Frank Ruhl Libre',serif; font-size:280px; line-height:1; color:var(--p); opacity:.05; z-index:0; }
    .page { position:relative; z-index:1; padding:52px 60px 44px; }
    .hd { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; border-bottom:1px solid var(--line); margin-bottom:8px; }
    .logo { max-height:50px; max-width:200px; } .wordmark { font-size:21px; color:var(--p); }
    .hd .kicker { font-family:'Frank Ruhl Libre',serif; font-style:italic; font-size:14px; color:var(--a); }
    .rule2 { height:3px; border-top:1px solid var(--p); border-bottom:1px solid var(--p); margin-bottom:34px; }
    .eyebrow { font-family:'Frank Ruhl Libre',serif; font-style:italic; font-size:15px; color:var(--a); margin-bottom:6px; }
    h1 { font-family:'Frank Ruhl Libre',serif; font-size:40px; line-height:1.1; font-weight:700; margin:0 0 10px; color:var(--p); }
    .meta { font-size:12px; color:var(--muted); margin-bottom:36px; }
    .sec { margin-bottom:30px; }
    .sec h2 { font-family:'Frank Ruhl Libre',serif; font-size:19px; color:var(--p); margin:0 0 12px; padding-bottom:8px; border-bottom:1px solid var(--line); }
    .body p { color:var(--ink); margin:0 0 8px; }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { position:relative; padding-inline-start:20px; margin-bottom:9px; color:var(--ink); }
    .scope-list li::before { content:"—"; position:absolute; inset-inline-start:0; color:var(--a); }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    thead th { text-align:right; font-family:'Frank Ruhl Libre',serif; font-size:13px; color:var(--p); font-weight:700; padding:0 6px 10px; border-bottom:2px solid var(--p); }
    thead th.c-amount { text-align:left; }
    tbody td { padding:14px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
    .c-name { font-weight:600; color:var(--ink); } .c-desc { color:var(--muted); } .c-amount { text-align:left; font-weight:700; white-space:nowrap; color:var(--ink); }
    .total-row { display:flex; justify-content:space-between; align-items:baseline; margin:24px 0 32px; padding:16px 22px; background:rgba(var(--prgb),.06); border-radius:2px; border-inline-start:3px solid var(--a); }
    .total-row .l { font-family:'Frank Ruhl Libre',serif; font-size:15px; color:var(--p); } .total-row .v { font-size:24px; font-weight:700; color:var(--p); }
    .notes p { color:var(--muted); font-size:12.5px; }
    .ft { margin-top:44px; padding-top:14px; border-top:1px solid var(--line); text-align:center; font-family:'Frank Ruhl Libre',serif; font-style:italic; font-size:12px; color:var(--muted); }`;
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
  return doc(`הצעת מחיר — ${d.title}`, css, body, bg);
}

/* 5. EMBLEM — centred floating logo on the logo-colour page + soft arcs. */
function tplEmblem(d: QuoteData): string {
  const bg = d.logoBg;
  const css = `
    :root { --p:${d.primary}; --a:${d.accent}; --prgb:${d.primaryRgb}; --argb:${d.accentRgb}; --ink:${ink(bg)}; --muted:${muted(bg)}; --line:${hairline(bg)}; }
    .sheet { position:relative; overflow:hidden; min-height:297mm; }
    .art-arc { top:-180px; inset-inline-start:-180px; width:440px; height:440px; border-radius:50%; z-index:0; background:radial-gradient(circle, rgba(var(--prgb),.12), transparent 66%); }
    .art-arc2 { bottom:-170px; inset-inline-end:-170px; width:380px; height:380px; border-radius:50%; z-index:0; background:radial-gradient(circle, rgba(var(--argb),.10), transparent 66%); }
    .page { position:relative; z-index:1; padding:52px 56px 40px; }
    .em { text-align:center; margin-bottom:36px; }
    .em .logo { max-height:66px; max-width:240px; margin:0 auto; } .em .wordmark { font-size:28px; color:var(--p); }
    .em .slogan { font-size:12px; color:var(--muted); margin-top:12px; }
    .em .eyebrow { font-size:10.5px; font-weight:600; letter-spacing:.16em; color:var(--a); text-transform:uppercase; margin-top:26px; margin-bottom:8px; }
    .em h1 { font-family:'Frank Ruhl Libre',serif; font-size:30px; line-height:1.15; margin:0 0 6px; color:var(--p); }
    .em .status { font-size:12px; color:var(--muted); }
    .sec { margin-bottom:28px; }
    .sec .eyebrow { font-size:10.5px; font-weight:600; letter-spacing:.16em; color:var(--muted); text-transform:uppercase; margin-bottom:8px; }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { position:relative; padding-inline-start:20px; margin-bottom:9px; color:var(--ink); }
    .scope-list li::before { content:""; position:absolute; width:6px; height:6px; inset-inline-start:2px; top:10px; border-radius:50%; background:var(--a); }
    table { width:100%; border-collapse:collapse; font-size:13.5px; }
    thead th { text-align:right; color:var(--p); font-size:11px; letter-spacing:.04em; font-weight:600; padding:0 6px 10px; border-bottom:2px solid var(--p); }
    thead th.c-amount { text-align:left; }
    tbody td { padding:13px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
    .c-name { font-weight:600; color:var(--ink); } .c-desc { color:var(--muted); } .c-amount { text-align:left; font-weight:600; white-space:nowrap; color:var(--ink); }
    .total-row { display:flex; justify-content:center; align-items:baseline; gap:14px; margin:24px 0 30px; padding:14px 24px; background:rgba(var(--prgb),.06); border-radius:999px; }
    .total-row .l { font-size:13px; color:var(--muted); } .total-row .v { font-size:23px; font-weight:700; color:var(--p); }
    .notes p { color:var(--muted); font-size:12.5px; }
    .ft { margin-top:42px; padding-top:14px; border-top:1px solid var(--line); text-align:center; font-size:10.5px; color:var(--muted); } .ft .m { color:var(--p); font-weight:600; }`;
  const body = `<div class="sheet">
    <div class="art art-arc"></div><div class="art art-arc2"></div>
    <div class="page">
      <div class="em">
        ${brandMark(d)}
        ${d.slogan ? `<div class="slogan">${esc(d.slogan)}</div>` : ''}
        <div class="eyebrow">הצעת מחיר</div><h1>${esc(d.title)}</h1>
        <div class="status">${esc(d.dateFormatted)} · ${d.statusLabel}</div>
      </div>
      ${d.intro ? `<div class="sec"><div class="eyebrow">היקף העבודה</div>${scopeHtml(d.intro)}</div>` : ''}
      ${d.items.length ? `<div class="sec"><div class="eyebrow">פירוט</div><table><thead><tr><th>פריט</th><th>תיאור</th><th class="c-amount">מחיר</th></tr></thead><tbody>${itemRows(d.items)}</tbody></table></div>` : ''}
      ${d.total ? `<div class="total-row"><span class="l">סה״כ</span><span class="v">${esc(d.total)}</span></div>` : ''}
      ${d.notes ? `<div class="sec notes"><div class="eyebrow">תנאים והערות</div>${paragraphsHtml(d.notes)}</div>` : ''}
      <div class="ft"><span class="m">${esc(d.name)}</span> · נערך ב-${esc(d.dateFormatted)}</div>
    </div>
  </div>`;
  return doc(`הצעת מחיר — ${d.title}`, css, body, bg);
}

/* ═══ OPTION 3 — white page; the logo floats on a logo-colour ELEMENT ════════ */

/* 6. SIDEBAR — white main, a logo-colour side band holds the floating logo. */
function tplSidebar(d: QuoteData): string {
  const band = d.logoUrl ? d.logoBg : d.primary;
  const bink = ink(band);
  const bmut = muted(band);
  const bline = hairline(band);
  const css = `
    :root { --p:${d.primary}; --a:${d.accent}; --prgb:${d.primaryRgb}; }
    .wrap { display:flex; min-height:297mm; }
    .aside { width:34%; background:${esc(band)}; color:${bink}; padding:40px 28px; display:flex; flex-direction:column; }
    .aside .brand-top { margin-bottom:auto; }
    .aside .logo { max-height:52px; max-width:150px; } .aside .wordmark { font-size:20px; color:${bink}; }
    .aside .slogan { font-size:11px; color:${bmut}; margin-top:12px; }
    .a-meta { margin-top:28px; font-size:12px; color:${bmut}; } .a-meta div { margin-bottom:6px; }
    .a-total { margin-top:22px; padding-top:18px; border-top:1px solid ${bline}; }
    .a-total .l { font-size:12px; color:${bmut}; } .a-total .v { font-size:24px; font-weight:700; color:${bink}; margin-top:4px; }
    .main { flex:1; padding:44px 44px 40px; }
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
      <div class="brand-top">${brandMark(d)}${d.slogan ? `<div class="slogan">${esc(d.slogan)}</div>` : ''}</div>
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
  return doc(`הצעת מחיר — ${d.title}`, css, body, '#ffffff');
}

/* 7. STRIP — white page, a logo-colour top strip holds the floating logo. */
function tplStrip(d: QuoteData): string {
  const strip = d.logoUrl ? d.logoBg : d.primary;
  const sink = ink(strip);
  const css = `
    :root { --p:${d.primary}; --a:${d.accent}; --prgb:${d.primaryRgb}; }
    .strip { background:${esc(strip)}; padding:26px 56px; display:flex; align-items:center; }
    .strip .logo { max-height:52px; max-width:220px; } .strip .wordmark { font-family:'Frank Ruhl Libre',serif; font-size:23px; color:${sink}; }
    .divider { height:4px; background:linear-gradient(90deg,var(--p),var(--a)); }
    .page { padding:32px 56px 40px; }
    .meta { display:flex; justify-content:space-between; font-size:11.5px; color:#8a91a0; margin-bottom:26px; } .meta .biz { font-weight:600; color:var(--p); }
    .eyebrow { font-size:10.5px; font-weight:600; letter-spacing:.16em; color:var(--a); text-transform:uppercase; margin-bottom:8px; }
    h1 { font-family:'Frank Ruhl Libre',serif; font-size:30px; line-height:1.15; margin:0 0 30px; color:var(--p); }
    .sec { margin-bottom:28px; } .sec .eyebrow { color:#8a91a0; }
    .scope-list { list-style:none; margin:0; padding:0; }
    .scope-list li { position:relative; padding-inline-start:20px; margin-bottom:9px; color:#414755; }
    .scope-list li::before { content:""; position:absolute; width:6px; height:6px; inset-inline-start:2px; top:10px; background:var(--a); }
    table { width:100%; border-collapse:collapse; font-size:13.5px; }
    thead th { text-align:right; color:var(--p); font-size:11px; letter-spacing:.04em; font-weight:600; padding:0 6px 10px; border-bottom:2px solid var(--p); }
    thead th.c-amount { text-align:left; }
    tbody td { padding:13px 6px; border-bottom:1px solid #edeff3; vertical-align:top; }
    .c-name { font-weight:600; } .c-desc { color:#6b7280; } .c-amount { text-align:left; font-weight:600; white-space:nowrap; }
    .total-row { display:flex; justify-content:flex-start; align-items:baseline; gap:14px; margin:22px 0 28px; padding:14px 20px; background:rgba(var(--prgb),.06); border-radius:8px; }
    .total-row .l { font-size:13px; color:#6b7280; } .total-row .v { font-size:24px; font-weight:700; color:var(--p); }
    .notes p { color:#8a91a0; font-size:12.5px; }
    .ft { margin-top:40px; padding-top:14px; border-top:1px solid #edeff3; display:flex; justify-content:space-between; font-size:10.5px; color:#8a91a0; } .ft .m { color:var(--p); font-weight:600; }`;
  const body = `<div class="strip">${brandMark(d)}</div>
    <div class="divider"></div>
    <div class="page">
      <div class="meta"><span class="biz">${esc(d.name)}</span><span>${esc(d.dateFormatted)} · ${d.statusLabel}</span></div>
      <div class="eyebrow">הצעת מחיר</div><h1>${esc(d.title)}</h1>
      ${d.intro ? `<div class="sec"><div class="eyebrow">היקף העבודה</div>${scopeHtml(d.intro)}</div>` : ''}
      ${d.items.length ? `<div class="sec"><div class="eyebrow">פירוט</div><table><thead><tr><th>פריט</th><th>תיאור</th><th class="c-amount">מחיר</th></tr></thead><tbody>${itemRows(d.items)}</tbody></table></div>` : ''}
      ${d.total ? `<div class="total-row"><span class="l">סה״כ לתשלום</span><span class="v">${esc(d.total)}</span></div>` : ''}
      ${d.notes ? `<div class="sec notes"><div class="eyebrow">תנאים והערות</div>${paragraphsHtml(d.notes)}</div>` : ''}
      <div class="ft"><span class="m">${esc(d.name)}</span><span>נערך ב-${esc(d.dateFormatted)}</span></div>
    </div>`;
  return doc(`הצעת מחיר — ${d.title}`, css, body, '#ffffff');
}

const RENDERERS: Record<QuoteTemplate, (d: QuoteData) => string> = {
  classic: tplClassic,
  bold: tplBold,
  minimal: tplMinimal,
  editorial: tplEditorial,
  emblem: tplEmblem,
  sidebar: tplSidebar,
  strip: tplStrip,
};

export function renderQuoteHtml(quote: Quote, business: Business): string {
  const key = (quote.template ?? 'classic') as QuoteTemplate;
  const render = RENDERERS[key] ?? tplClassic;
  return render(buildData(quote, business));
}

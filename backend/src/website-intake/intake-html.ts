import { WebsiteIntake } from './website-intake.entity';

/**
 * Branded, print-ready HTML for a website-intake brief — Portal Studio's own
 * document (not a per-tenant business), so it uses the studio palette directly.
 * TRUSTED template: every user string is HTML-escaped and the result is rendered
 * through `PdfRendererService.renderHtmlToPdf`. Assets arrive as inline `data:`
 * URIs so the public token render needs no network/file access.
 */

const NAVY = '#062340';
const CORAL = '#DC5D46';
const STEEL = '#6091B0';
const CREAM = '#F0E1D5';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&family=Frank+Ruhl+Libre:wght@500;700&display=swap');`;

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Assets already resolved to inline data URIs by the PDF service. */
export interface IntakeHtmlAssets {
  logo: string | null;
  images: string[];
}

function contactLine(intake: WebsiteIntake): string {
  const parts = [intake.contactName, intake.phone, intake.email]
    .map((p) => (p ? p.trim() : ''))
    .filter(Boolean)
    .map(esc);
  return parts.join(' · ');
}

function sectionsHtml(intake: WebsiteIntake): string {
  return intake.sections
    .map((section) => {
      const rows = section.items
        .map(
          (it) => `<div class="row">
            <div class="k">${esc(it.label)}</div>
            <div class="v">${esc(it.value).replace(/\n/g, '<br/>')}</div>
          </div>`,
        )
        .join('\n');
      return `<section class="sec">
        <h2>${esc(section.title)}</h2>
        ${rows}
      </section>`;
    })
    .join('\n');
}

function assetsHtml(assets: IntakeHtmlAssets): string {
  const blocks: string[] = [];
  if (assets.logo) {
    blocks.push(`<section class="sec">
      <h2>לוגו</h2>
      <img class="logo-asset" src="${assets.logo}" alt="logo" />
    </section>`);
  }
  if (assets.images.length > 0) {
    const grid = assets.images
      .map((src) => `<img class="gimg" src="${src}" alt="image" />`)
      .join('\n');
    blocks.push(`<section class="sec">
      <h2>תמונות</h2>
      <div class="grid">${grid}</div>
    </section>`);
  }
  return blocks.join('\n');
}

export function renderIntakeHtml(
  intake: WebsiteIntake,
  assets: IntakeHtmlAssets,
): string {
  const title = intake.businessName || intake.contactName || 'בריף אתר';
  const dateFormatted = new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(intake.createdAt ?? new Date());

  const css = `
    ${FONTS}
    * { box-sizing: border-box; }
    @page { margin: 0; }
    body {
      margin: 0; background: #fff; color: #20242e;
      font-family: 'Rubik', 'Heebo', Arial, sans-serif;
      line-height: 1.7; font-size: 13.5px;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .sheet { position: relative; overflow: hidden; min-height: 297mm; }
    .bar { height: 6px; background: linear-gradient(90deg, ${NAVY}, ${STEEL} 55%, ${CORAL}); }
    .head {
      background: ${NAVY}; color: #fff; padding: 34px 46px 30px; position: relative; overflow: hidden;
    }
    .head::after {
      content: ""; position: absolute; top: -80px; inset-inline-end: -60px; width: 240px; height: 240px;
      border-radius: 50%; background: radial-gradient(circle, rgba(96,145,176,.45), transparent 65%);
    }
    .wordmark {
      font-family: 'Frank Ruhl Libre', Georgia, serif; font-weight: 700; letter-spacing: .06em;
      font-size: 15px; color: ${CREAM}; position: relative; z-index: 1;
    }
    .eyebrow {
      margin-top: 22px; font-size: 10.5px; font-weight: 600; letter-spacing: .2em;
      text-transform: uppercase; color: ${STEEL}; position: relative; z-index: 1;
    }
    h1 {
      font-family: 'Frank Ruhl Libre', serif; font-size: 30px; line-height: 1.15; font-weight: 700;
      margin: 6px 0 0; color: #fff; position: relative; z-index: 1;
    }
    .contact { margin-top: 10px; font-size: 12px; color: rgba(255,255,255,.75); position: relative; z-index: 1; }
    .date { margin-top: 2px; font-size: 11px; color: rgba(255,255,255,.55); position: relative; z-index: 1; }
    .page { padding: 30px 46px 40px; }
    .sec { margin-bottom: 22px; break-inside: avoid; }
    .sec h2 {
      font-family: 'Frank Ruhl Libre', serif; font-size: 16px; color: ${NAVY}; margin: 0 0 10px;
      padding-bottom: 7px; border-bottom: 2px solid ${CREAM};
    }
    .row { display: flex; gap: 14px; padding: 5px 0; align-items: baseline; }
    .row .k { flex: 0 0 34%; color: ${STEEL}; font-weight: 600; font-size: 12.5px; }
    .row .v { flex: 1; color: #2b303b; }
    .logo-asset { max-height: 90px; max-width: 240px; object-fit: contain; }
    .grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .gimg {
      width: 150px; height: 150px; object-fit: cover; border-radius: 10px; border: 1px solid #e7e3da;
    }
    .ft {
      margin-top: 30px; padding-top: 14px; border-top: 1px solid #ece7dd;
      display: flex; justify-content: space-between; font-size: 10.5px; color: #9aa0ab;
    }
    .ft .m { color: ${NAVY}; font-weight: 600; }`;

  const body = `<div class="sheet">
    <div class="bar"></div>
    <div class="head">
      <div class="wordmark">PORTAL STUDIO</div>
      <div class="eyebrow">בריף לבניית אתר</div>
      <h1>${esc(title)}</h1>
      ${contactLine(intake) ? `<div class="contact">${contactLine(intake)}</div>` : ''}
      <div class="date">${esc(dateFormatted)}</div>
    </div>
    <div class="page">
      ${sectionsHtml(intake)}
      ${assetsHtml(assets)}
      <div class="ft"><span class="m">PORTAL STUDIO</span><span>בריף אתר · ${esc(dateFormatted)}</span></div>
    </div>
  </div>`;

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${esc(`בריף אתר — ${title}`)}</title>
  <style>${css}</style>
</head>
<body>${body}</body>
</html>`;
}

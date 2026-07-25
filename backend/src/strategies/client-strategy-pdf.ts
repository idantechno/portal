/**
 * Turns the client-facing strategy markdown into a print-ready, branded HTML
 * document for PDF export. The markdown subset is fully controlled by
 * `renderClientStrategy` (headings, bold, italic, dash bullet lists, pipe
 * tables, blockquotes, horizontal rules, paragraphs), so a small purpose-built
 * converter is enough — no markdown dependency, and no arbitrary HTML reaches
 * the renderer.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inline formatting: **bold** then *italic* (bold consumed first). */
function inline(s: string): string {
  let h = escapeHtml(s);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return h;
}

/** Splits a table row on unescaped pipes, unescaping `\|` back to `|`. */
function splitCells(row: string): string[] {
  return row
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => inline(c.replace(/\\\|/g, '|').trim()));
}

/** The `|---|---|` divider row under a table header. */
function isTableSeparator(row: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(row) && row.includes('-');
}

function mdToHtml(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '') {
      i++;
      continue;
    }
    if (t === '---') {
      html.push('<hr>');
      i++;
      continue;
    }
    const heading = t.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (t.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(inline(lines[i].trim().replace(/^>\s?/, '')));
        i++;
      }
      html.push(`<blockquote>${buf.join('<br>')}</blockquote>`);
      continue;
    }
    if (t.startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim());
        i++;
      }
      const header = rows[0];
      const body = rows.slice(1).filter((r) => !isTableSeparator(r));
      const thead = `<thead><tr>${splitCells(header)
        .map((c) => `<th>${c}</th>`)
        .join('')}</tr></thead>`;
      const tbody = `<tbody>${body
        .map(
          (r) =>
            `<tr>${splitCells(r)
              .map((c) => `<td>${c}</td>`)
              .join('')}</tr>`,
        )
        .join('')}</tbody>`;
      html.push(`<table>${thead}${tbody}</table>`);
      continue;
    }
    if (t.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(`<li>${inline(lines[i].trim().slice(2))}</li>`);
        i++;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    html.push(`<p>${inline(t)}</p>`);
    i++;
  }
  return html.join('\n');
}

/** Wraps the converted body in the branded, RTL, A4 print template. */
export function renderClientStrategyHtml(markdown: string): string {
  const body = mdToHtml(markdown);
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&family=Frank+Ruhl+Libre:wght@500;700&display=swap');
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Heebo', system-ui, sans-serif; color: #10233a; font-size: 12.5px; line-height: 1.75; }
.brand { color: #6091B0; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 14px; }
h1 { font-family: 'Frank Ruhl Libre', Georgia, serif; font-size: 27px; line-height: 1.2; color: #062340; margin: 0 0 6px; }
h2 { font-family: 'Frank Ruhl Libre', Georgia, serif; font-size: 18px; color: #062340; margin: 26px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #cfe0ec; break-after: avoid; }
h3 { font-size: 13.5px; color: #37566c; margin: 16px 0 6px; break-after: avoid; }
p { margin: 7px 0; }
strong { color: #062340; font-weight: 700; }
em { font-style: normal; color: #6b7b8c; font-size: 11px; }
blockquote { margin: 12px 0; padding: 10px 16px; background: #eef4f9; border-inline-start: 4px solid #6091B0; border-radius: 8px; color: #23405a; }
blockquote strong { color: #062340; }
ul { margin: 8px 0; padding-inline-start: 22px; }
li { margin: 3px 0; }
hr { border: none; border-top: 1px solid #e8eef4; margin: 2px 0; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11.5px; break-inside: avoid; }
th { background: #062340; color: #fff; text-align: start; padding: 7px 10px; font-weight: 600; }
td { border: 1px solid #e0e8f0; padding: 7px 10px; vertical-align: top; }
tbody tr:nth-child(even) td { background: #f6f9fb; }
</style>
</head>
<body>
<div class="brand">Portal Studio</div>
${body}
</body>
</html>`;
}

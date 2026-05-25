// Minimal, safe markdown renderer for context-file previews.
// Supports: ATX headings (#..######), fenced code blocks (```), inline code (`),
// **bold**, *italic*, [text](url), - / * / + bullet lists, 1. numbered lists,
// > blockquotes, paragraphs, horizontal rules (---).
// HTML in the source is escaped — output is safe to inject via dangerouslySetInnerHTML.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  // inline code: `code`
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // bold: **text**
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // italic: *text* (avoid matching ** which we already handled — single * not adjacent to *)
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  // links: [text](url) — url restricted to http/https/mailto/relative
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label, href) => {
      const safe = /^(https?:\/\/|mailto:|\/|#)/i.test(href) ? href : "#";
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
  );
  return out;
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let inUl = false;
  let inOl = false;
  let inBq = false;
  let paraBuf: string[] = [];

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };
  const closeBq = () => {
    if (inBq) {
      out.push("</blockquote>");
      inBq = false;
    }
  };
  const flushPara = () => {
    if (paraBuf.length) {
      out.push(`<p>${renderInline(paraBuf.join(" "))}</p>`);
      paraBuf = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      flushPara();
      closeLists();
      closeBq();
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(
        `<pre><code${cls}>${escapeHtml(buf.join("\n"))}</code></pre>`,
      );
      continue;
    }

    // blank line — paragraph break / list end
    if (/^\s*$/.test(line)) {
      flushPara();
      closeLists();
      closeBq();
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*---+\s*$/.test(line) || /^\s*\*\*\*+\s*$/.test(line)) {
      flushPara();
      closeLists();
      closeBq();
      out.push("<hr />");
      i++;
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      flushPara();
      closeLists();
      closeBq();
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // blockquote
    const bq = line.match(/^\s*>\s?(.*)$/);
    if (bq) {
      flushPara();
      closeLists();
      if (!inBq) {
        out.push("<blockquote>");
        inBq = true;
      }
      out.push(`<p>${renderInline(bq[1])}</p>`);
      i++;
      continue;
    } else {
      closeBq();
    }

    // unordered list item
    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ul) {
      flushPara();
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${renderInline(ul[1])}</li>`);
      i++;
      continue;
    }

    // ordered list item
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      flushPara();
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${renderInline(ol[1])}</li>`);
      i++;
      continue;
    }

    // paragraph line
    if (inUl || inOl) closeLists();
    paraBuf.push(line.trim());
    i++;
  }

  flushPara();
  closeLists();
  closeBq();
  return out.join("\n");
}

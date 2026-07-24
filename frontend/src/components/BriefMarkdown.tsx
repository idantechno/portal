import { Fragment, type ReactNode } from "react";

/**
 * Small markdown renderer for brief documents.
 *
 * Deliberately not a general-purpose parser — it covers exactly what the brief
 * generator emits (headings, rules, quotes, bullet lists, tables, bold, code)
 * and, on top of that, gives the three source tags and the ⟨לא ידוע⟩ marker
 * their own visual weight. That highlighting is the point: a brief is read to
 * find what still needs a human, and those markers are that signal.
 */

const TOKEN =
  /(\*\*[^*]+\*\*|`[^`]+`|⟨[^⟩]*⟩|🟠[^·|\n]*|🔵\[\d+\]|🔵|🟢[^·|\n]*|⚠️|✅|⛔)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(TOKEN).filter((p) => p !== "");
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-navy-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[0.85em] text-navy-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("⟨")) {
      return (
        <span
          key={key}
          className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
        >
          {part}
        </span>
      );
    }
    if (part.startsWith("🟠")) {
      return (
        <span
          key={key}
          className="rounded bg-coral-50 px-1.5 py-0.5 text-xs font-medium text-coral-600 ring-1 ring-coral-200"
        >
          {part.trim()}
        </span>
      );
    }
    if (part.startsWith("🟢")) {
      return (
        <span
          key={key}
          className="rounded bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200"
        >
          {part.trim()}
        </span>
      );
    }
    if (part.startsWith("🔵")) {
      return (
        <span
          key={key}
          className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200"
        >
          {part}
        </span>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

function splitRow(row: string): string[] {
  return row
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isDivider = (row: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(row);

export function BriefMarkdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`ul-${key++}`} className="my-3 space-y-1.5 ps-5">
        {items.map((item, i) => (
          <li key={i} className="list-disc text-sm leading-6 text-navy-700">
            {inline(item, `li-${i}`)}
          </li>
        ))}
      </ul>,
    );
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    const items = quote;
    quote = [];
    blocks.push(
      <blockquote
        key={`bq-${key++}`}
        className="my-3 border-s-4 border-brand-200 bg-brand-50/40 px-4 py-2.5 text-sm leading-6 text-navy-600"
      >
        {items.map((line, i) => (
          <p key={i}>{inline(line, `bq-${i}`)}</p>
        ))}
      </blockquote>,
    );
  };
  const flushAll = () => {
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (line.startsWith("<!--")) continue;
    if (line.trim() === "") {
      flushAll();
      continue;
    }

    if (line.startsWith("- ")) {
      flushQuote();
      list.push(line.slice(2));
      continue;
    }
    if (line.startsWith("> ")) {
      flushList();
      quote.push(line.slice(2));
      continue;
    }
    flushAll();

    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#+\s*/, "");
      const cls =
        level === 1
          ? "font-display text-2xl font-bold text-navy-900 mt-2 mb-4"
          : level === 2
            ? "font-display text-lg font-bold text-navy-900 mt-7 mb-3 pb-2 border-b border-navy-100"
            : "font-display text-base font-semibold text-navy-800 mt-5 mb-2";
      const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : "h3") as "h1";
      blocks.push(
        <Tag key={`h-${key++}`} className={cls}>
          {inline(text, `h-${i}`)}
        </Tag>,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${key++}`} className="my-6 hairline" />);
      continue;
    }

    if (line.trimStart().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        rows.push(lines[i]);
        i++;
      }
      i--;
      const body = rows.filter((r) => !isDivider(r));
      if (body.length === 0) continue;
      const [head, ...rest] = body;
      blocks.push(
        <div key={`tbl-${key++}`} className="my-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="bg-navy-50/70">
                {splitRow(head).map((cell, ci) => (
                  <th
                    key={ci}
                    className="border border-navy-100 px-3 py-2 text-start font-semibold text-navy-800"
                  >
                    {inline(cell, `th-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rest.map((row, ri) => (
                <tr key={ri} className="align-top">
                  {splitRow(row).map((cell, ci) => (
                    <td
                      key={ci}
                      className="border border-navy-100 px-3 py-2 text-navy-700"
                    >
                      {inline(cell, `td-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    blocks.push(
      <p key={`p-${key++}`} className="my-2 text-sm leading-6 text-navy-700">
        {inline(line, `p-${i}`)}
      </p>,
    );
  }
  flushAll();

  return <div className="brief-markdown">{blocks}</div>;
}

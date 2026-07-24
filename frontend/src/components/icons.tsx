/**
 * Portal Studio icon system.
 *
 * One visual language for every glyph in the product — no emoji anywhere.
 *
 * Rules every icon follows (do not break them when adding one):
 *  - 24×24 viewBox, artwork lives inside a 20×20 optical area (≈2px padding).
 *  - Outline only: `stroke="currentColor"`, `fill="none"`, round caps + joins.
 *  - One stroke weight for the whole set (1.6 at 20px, scaled by `size`), so
 *    icons sitting side by side have identical optical density.
 *  - Geometry is built from primitives (rects with rx, circles, straight runs,
 *    semicircular arcs). That is what gives the set its "drafted" feel.
 *  - Solid dots are the ONE exception to fill-none — they're the accent that
 *    keeps outline-only icons from reading as flat.
 *
 * Icons must be legible at 16px. If a glyph needs more than ~4 strokes to be
 * understood, pick a simpler metaphor instead.
 */

const DOT = { fill: "currentColor", stroke: "none" } as const;

/* eslint-disable react-refresh/only-export-components */

const paths: Record<string, React.ReactNode> = {
  /* ---- Navigation / departments ---------------------------------------- */
  home: (
    <>
      <path d="M3.6 10.4 12 3.8l8.4 6.6" />
      <path d="M5.7 8.9v9.4a2.2 2.2 0 0 0 2.2 2.2h8.2a2.2 2.2 0 0 0 2.2-2.2V8.9" />
      <path d="M9.7 20.5v-5.8h4.6v5.8" />
    </>
  ),
  chat: (
    <>
      <rect x="3.5" y="4.5" width="17" height="12" rx="3.6" />
      <path d="M8.6 16.5v4l4.6-4" />
    </>
  ),
  leads: (
    <>
      <circle cx="9.8" cy="8.2" r="3.5" />
      <path d="M3.7 20.3v-.8a5.3 5.3 0 0 1 5.3-5.3h1.6a5.3 5.3 0 0 1 3.5 1.3" />
      <path d="M17.6 14.9v5.4M14.9 17.6h5.4" />
    </>
  ),
  agents: (
    <>
      <path d="M12 3.2 13.7 9.4 20 11.1 13.7 12.8 12 19 10.3 12.8 4 11.1 10.3 9.4Z" />
      <path d="M18.4 16.4l.6 2.1 2.1.6-2.1.6-.6 2.1-.6-2.1-2.1-.6 2.1-.6Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.2" width="17" height="15.3" rx="3.4" />
      <path d="M3.5 10h17" />
      <path d="M8.2 3.4v3.6M15.8 3.4v3.6" />
      <circle cx="8.4" cy="14.4" r="1.05" {...DOT} />
      <circle cx="12" cy="14.4" r="1.05" {...DOT} />
    </>
  ),
  tasks: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.6" />
      <path d="M8.1 12.1 10.8 14.8 15.9 9.4" />
    </>
  ),
  doc: (
    <>
      <path d="M13.9 3.5H8.4A2.6 2.6 0 0 0 5.8 6.1v11.8a2.6 2.6 0 0 0 2.6 2.6h7.2a2.6 2.6 0 0 0 2.6-2.6V7.6Z" />
      <path d="M13.9 3.5v4.1h4.3" />
      <path d="M9.2 12.6h5.6M9.2 16h3.6" />
    </>
  ),
  folder: (
    <path d="M3.5 9.2V6.9a2.4 2.4 0 0 1 2.4-2.4h3.2L11.6 7h6.5a2.4 2.4 0 0 1 2.4 2.4v8.2a2.4 2.4 0 0 1-2.4 2.4H5.9a2.4 2.4 0 0 1-2.4-2.4Z" />
  ),
  receipt: (
    <>
      <path d="M5.6 20.5 8.9 18.5 12 20.5 15.1 18.5 18.4 20.5V5.7a2.2 2.2 0 0 0-2.2-2.2H7.8a2.2 2.2 0 0 0-2.2 2.2Z" />
      <path d="M9 8.4h6M9 12.1h4" />
    </>
  ),
  wallet: (
    <>
      <path d="M19.6 9.7V8.2a2.6 2.6 0 0 0-2.6-2.6H6.1a2.6 2.6 0 0 0-2.6 2.6v8.6a2.6 2.6 0 0 0 2.6 2.6H17a2.6 2.6 0 0 0 2.6-2.6v-1.5" />
      <path d="M20.5 9.7h-3.8a2.6 2.6 0 0 0 0 5.2h3.8Z" />
      <circle cx="17" cy="12.3" r="0.95" {...DOT} />
    </>
  ),
  growth: (
    <>
      <path d="M3.6 16.6 9 11.2l3.5 3.5 7.9-7.9" />
      <path d="M15.2 6.8h5.2V12" />
    </>
  ),
  bolt: <path d="M13.4 2.8 5.2 13.1h5.6l-.2 8.1 8.2-10.3h-5.6Z" />,
  link: (
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M13.5 6.9 15.1 5.3a4.3 4.3 0 0 1 6.1 6.1l-1.6 1.6" />
      <path d="M10.5 17.1 8.9 18.7a4.3 4.3 0 0 1-6.1-6.1l1.6-1.6" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8.4" r="3.5" />
      <path d="M3.2 20.4v-.7a5.4 5.4 0 0 1 5.4-5.4h1.8a5.4 5.4 0 0 1 5.4 5.4v.7" />
      <path d="M16.4 5.4a3.5 3.5 0 0 1 0 6" />
      <path d="M18 14.6a5.4 5.4 0 0 1 2.8 4.7v.9" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20.5 11.8a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.3-4.6A8.4 8.4 0 1 1 20.5 11.8Z" />
      <path d="M8.9 9.2a1 1 0 0 1 .9-1l1-.1.9 2-.9.8c.5 1.2 1.4 2.1 2.6 2.6l.8-.9 2 .9-.1 1a1 1 0 0 1-1 .9 7.4 7.4 0 0 1-6.2-6.2Z" />
    </>
  ),
  settings: (
    <>
      <path d="M3.5 7.6h8.2M16.4 7.6h4.1M3.5 16.4h4.1M12.3 16.4h8.2" />
      <circle cx="14" cy="7.6" r="2.3" />
      <circle cx="10" cy="16.4" r="2.3" />
    </>
  ),

  /* ---- Agents & content ------------------------------------------------ */
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.4 8.6 13.7 13.7 8.6 15.4 10.3 10.3Z" />
    </>
  ),
  pencil: (
    <>
      <path d="M4.2 20.4 4.9 16.8 15.1 6.6l2.9 2.9L7.8 19.7Z" />
      <path d="M15.9 5.8 17.3 4.4a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1l-1.4 1.4Z" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6.8" rx="7" ry="3.1" />
      <path d="M5 6.8v4.6c0 1.7 3.1 3.1 7 3.1s7-1.4 7-3.1V6.8" />
      <path d="M5 11.4v5.8c0 1.7 3.1 3.1 7 3.1s7-1.4 7-3.1v-5.8" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3.5 10.3v3.4a2.3 2.3 0 0 0 2.3 2.3h1.7l8.4 4.2V3.8L7.5 8H5.8a2.3 2.3 0 0 0-2.3 2.3Z" />
      <path d="M19.3 9.4a3.6 3.6 0 0 1 0 5.2" />
    </>
  ),
  chart: (
    <>
      <path d="M3.4 20.6h17.2" />
      <path d="M6.6 20.5v-6.3M12 20.5V5.1M17.4 20.5v-9.2" />
    </>
  ),
  idea: (
    <>
      <path d="M9 17.4a5.9 5.9 0 1 1 6 0v1.5a1.7 1.7 0 0 1-1.7 1.7h-2.6A1.7 1.7 0 0 1 9 18.9Z" />
      <path d="M9.5 17.5h5" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 2.2-.9 2.2-2.1 0-.5-.2-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1.2.9-2.1 2.1-2.1h1.8c2 0 3.5-1.6 3.5-3.6 0-3.8-3.8-6.5-8.5-6.5Z" />
      <circle cx="8.1" cy="9.4" r="1.15" {...DOT} />
      <circle cx="12.6" cy="7.5" r="1.15" {...DOT} />
      <circle cx="7.4" cy="14" r="1.15" {...DOT} />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="13.2" r="7.3" />
      <path d="M12 9.2v4l2.7 1.7" />
      <path d="M4.4 5.4 7.2 3M19.6 5.4 16.8 3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 10.6a6 6 0 0 1 12 0v4.1l1.6 2.4a.7.7 0 0 1-.6 1.1H5a.7.7 0 0 1-.6-1.1L6 14.7Z" />
      <path d="M9.8 18.2a2.2 2.2 0 0 0 4.4 0" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.4" width="17" height="13.2" rx="3.2" />
      <path d="M5.4 8.6 11 12.7a1.7 1.7 0 0 0 2 0l5.6-4.1" />
    </>
  ),
  news: (
    <>
      <rect x="3.5" y="5.4" width="17" height="13.2" rx="2.8" />
      <path d="M7 9.4h5.6M7 12.8h5.6M7 15.6h3.4" />
      <rect x="15" y="9.4" width="3.6" height="4.2" rx="1.1" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17Z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1.4" {...DOT} />
    </>
  ),
  paperclip: (
    <path d="M17.4 10.6 10.9 17a3.6 3.6 0 0 1-5.1-5.1l7.6-7.6a2.4 2.4 0 0 1 3.4 3.4l-7.6 7.6a1.2 1.2 0 0 1-1.7-1.7l6.5-6.5" />
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="3.2" />
      <path d="M8 10V7.9a4 4 0 0 1 8 0V10" />
      <circle cx="12" cy="15.3" r="1.2" {...DOT} />
    </>
  ),
  hourglass: (
    <>
      <path d="M6.8 3.5h10.4M6.8 20.5h10.4" />
      <path d="M8.3 3.5v3.1c0 2 3.7 3.5 3.7 5.4 0 1.9-3.7 3.4-3.7 5.4v3.1" />
      <path d="M15.7 3.5v3.1c0 2-3.7 3.5-3.7 5.4 0 1.9 3.7 3.4 3.7 5.4v3.1" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="16.7" cy="7.3" r="1.15" {...DOT} />
    </>
  ),

  /* ---- Status ---------------------------------------------------------- */
  check: <path d="M4.8 12.5 9.6 17.3 19.2 6.9" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 12.2 10.9 14.9 15.9 9.3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11.2v5" />
      <circle cx="12" cy="7.9" r="1.05" {...DOT} />
    </>
  ),
  warning: (
    <>
      <path d="M12.9 4.9a1.1 1.1 0 0 0-1.8 0L3.3 18.8a1.1 1.1 0 0 0 .9 1.7h15.6a1.1 1.1 0 0 0 .9-1.7Z" />
      <path d="M12 10v4.3" />
      <circle cx="12" cy="17.5" r="1.05" {...DOT} />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.6v5.1" />
      <circle cx="12" cy="16.3" r="1.05" {...DOT} />
    </>
  ),

  /* ---- Weather (Home overview) ----------------------------------------- */
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" />
    </>
  ),
  cloud: (
    <path d="M7.6 19a4.3 4.3 0 0 1 .3-8.6 5.2 5.2 0 0 1 9.8 1.4 3.7 3.7 0 0 1-.9 7.2Z" />
  ),
  "cloud-sun": (
    <>
      <path d="M7.3 6.6V4.9M4.1 8.1 2.9 6.9M4.1 12.9 2.9 14.1M11.7 8.1l1.2-1.2" />
      <circle cx="7.3" cy="10.5" r="2.6" />
      <path d="M11.2 20.3a3.7 3.7 0 0 1 .3-7.4 4.5 4.5 0 0 1 8.5 1.2 3.2 3.2 0 0 1-.8 6.2Z" />
    </>
  ),
  rain: (
    <>
      <path d="M7.6 15.4a4.3 4.3 0 0 1 .3-8.6 5.2 5.2 0 0 1 9.8 1.4 3.7 3.7 0 0 1-.9 7.2Z" />
      <path d="M9 18.2 8.1 20.8M12.4 18.2l-.9 2.6M15.8 18.2l-.9 2.6" />
    </>
  ),
  snow: (
    <>
      <path d="M7.6 15.4a4.3 4.3 0 0 1 .3-8.6 5.2 5.2 0 0 1 9.8 1.4 3.7 3.7 0 0 1-.9 7.2Z" />
      <circle cx="8.8" cy="19.3" r="1.05" {...DOT} />
      <circle cx="12" cy="20.6" r="1.05" {...DOT} />
      <circle cx="15.2" cy="19.3" r="1.05" {...DOT} />
    </>
  ),
  storm: (
    <>
      <path d="M7.6 15.4a4.3 4.3 0 0 1 .3-8.6 5.2 5.2 0 0 1 9.8 1.4 3.7 3.7 0 0 1-.9 7.2Z" />
      <path d="M12.7 16.4 10.3 19.5h2.8l-2 2.5" />
    </>
  ),
  fog: (
    <>
      <path d="M7.6 13.9a4.3 4.3 0 0 1 .3-8.6 5.2 5.2 0 0 1 9.8 1.4 3.7 3.7 0 0 1-.9 7.2Z" />
      <path d="M5.4 17.4h13.2M7.4 20.5h9.2" />
    </>
  ),

  /* ---- Generic UI ------------------------------------------------------ */
  /* Directional pair. Drawn for LTR (start = left) and auto-mirrored in RTL by
     the `icon-dir` class the component adds — see index.css. Use `-start` for
     back/previous and `-end` for forward/next, never a literal ←/→. */
  "arrow-start": (
    <>
      <path d="M20 12H4.4" />
      <path d="M10.8 5.6 4.4 12l6.4 6.4" />
    </>
  ),
  "arrow-end": (
    <>
      <path d="M4 12h15.6" />
      <path d="M13.2 5.6 19.6 12l-6.4 6.4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" />,
  plus: <path d="M12 4.8v14.4M4.8 12h14.4" />,
  minus: <path d="M4.8 12h14.4" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="M15.4 15.4 20.5 20.5" />
    </>
  ),
  "chevron-down": <path d="M6.5 9.5 12 15l5.5-5.5" />,
  "chevron-up": <path d="M6.5 14.5 12 9l5.5 5.5" />,
  "chevron-start": <path d="M14.5 5.5 8 12l6.5 6.5" />,
  "chevron-end": <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  external: (
    <>
      <path d="M13.6 4.5h5.9v5.9" />
      <path d="M19.5 4.5 11.6 12.4" />
      <path d="M18.4 14.1v3.8a2.6 2.6 0 0 1-2.6 2.6H6.1a2.6 2.6 0 0 1-2.6-2.6V8.2a2.6 2.6 0 0 1 2.6-2.6h3.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4.6 6.8h14.8" />
      <path d="M9.2 6.8V5.5a2 2 0 0 1 2-2h1.6a2 2 0 0 1 2 2v1.3" />
      <path d="M6.6 6.8v11.6a2.6 2.6 0 0 0 2.6 2.6h5.6a2.6 2.6 0 0 0 2.6-2.6V6.8" />
      <path d="M10.4 10.6v6.2M13.6 10.6v6.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20.5 3.8v4.6h-4.6" />
    </>
  ),
  send: (
    <>
      <path d="M20.6 3.4 3.9 9.6a.6.6 0 0 0 0 1.1l6.9 2.5 2.5 6.9a.6.6 0 0 0 1.1 0Z" />
      <path d="M10.8 13.2 20.6 3.4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.8v10.9" />
      <path d="M7.8 10.7 12 14.9l4.2-4.2" />
      <path d="M4.5 17.2v1.1a2.2 2.2 0 0 0 2.2 2.2h10.6a2.2 2.2 0 0 0 2.2-2.2v-1.1" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.2V4.3" />
      <path d="M7.8 8.5 12 4.3l4.2 4.2" />
      <path d="M4.5 17.2v1.1a2.2 2.2 0 0 0 2.2 2.2h10.6a2.2 2.2 0 0 0 2.2-2.2v-1.1" />
    </>
  ),
  logout: (
    <>
      <path d="M14.6 4.5h2.9a2.6 2.6 0 0 1 2.6 2.6v9.8a2.6 2.6 0 0 1-2.6 2.6h-2.9" />
      <path d="M9.6 8.2 5.8 12l3.8 3.8" />
      <path d="M6 12h8.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.7" />
      <path d="M4.6 20.4v-.9a5.4 5.4 0 0 1 5.4-5.4h4a5.4 5.4 0 0 1 5.4 5.4v.9" />
    </>
  ),
  building: (
    <>
      <path d="M4.5 20.5V6.2a2.2 2.2 0 0 1 2.2-2.2h6.4a2.2 2.2 0 0 1 2.2 2.2v14.3" />
      <path d="M15.3 10.4h2.5a2.2 2.2 0 0 1 2.2 2.2v7.9" />
      <path d="M3.4 20.6h17.2" />
      <path d="M8.2 8.2h3.2M8.2 12h3.2M8.2 15.8h3.2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.6 4.8 6.4v5.3c0 4 2.9 7.6 7.2 8.7 4.3-1.1 7.2-4.7 7.2-8.7V6.4Z" />
      <path d="M9.2 12.1 11.3 14.2 15 10" />
    </>
  ),
};

export type IconName = keyof typeof paths;

/** Every glyph in the set. Used by the dev-only icon sheet at /dev/icons. */
export const ICON_NAMES = Object.keys(paths) as IconName[];

export interface IconProps {
  name: IconName;
  /** Rendered box in px. Stroke weight scales with it so density stays even. */
  size?: number;
  className?: string;
  /** Accessible label. Omit for decorative icons (the default). */
  title?: string;
}

export function Icon({ name, size = 20, className, title }: IconProps) {
  const art = paths[name];
  if (!art) return null;
  // Symbols never mirror in RTL — a house is a house. Only the directional
  // pairs do, and they opt in by name so callers can't get it wrong.
  const directional = /-(start|end)$/.test(name as string);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={(1.6 * 20) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[directional && "icon-dir", className].filter(Boolean).join(" ")}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ flexShrink: 0 }}
    >
      {title && <title>{title}</title>}
      {art}
    </svg>
  );
}

export function hasIcon(name: string): name is IconName {
  return name in paths;
}

/**
 * Backend-driven glyphs (agent catalog, integration providers, weather codes)
 * send a slug, not an emoji. Unknown slugs fall back to a neutral mark so a new
 * backend value can never render as a broken box.
 */
export function ServerIcon({
  name,
  size = 20,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  return (
    <Icon
      name={name && hasIcon(name) ? name : "agents"}
      size={size}
      className={className}
    />
  );
}

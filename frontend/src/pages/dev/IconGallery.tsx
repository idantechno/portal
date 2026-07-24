import { Icon, ICON_NAMES } from "../../components/icons";

/**
 * Dev-only contact sheet for the icon set. Routed at /dev/icons behind
 * `import.meta.env.DEV`, so it never reaches a production bundle.
 *
 * Use it when adding a glyph: the row of small sizes is the real test — an
 * icon that only works at 32px does not belong in the set.
 */
export default function IconGallery() {
  return (
    <div className="min-h-dvh bg-cream-50 p-8" dir="rtl">
      <h1 className="font-display text-2xl text-navy-900">Portal Studio Icons</h1>
      <p className="mt-1 text-sm text-navy-500">
        {ICON_NAMES.length} גליפים · 24 גריד · משיכה 1.6 · currentColor
      </p>

      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {ICON_NAMES.map((name) => (
          <div
            key={name}
            className="rounded-2xl border border-navy-100/70 bg-white p-4 text-center shadow-[var(--shadow-e1)]"
          >
            <div className="flex items-end justify-center gap-3 text-navy-700">
              <Icon name={name} size={28} />
              <Icon name={name} size={20} />
              <Icon name={name} size={16} />
            </div>
            <div
              className="mt-3 truncate font-mono text-[11px] text-navy-400"
              dir="ltr"
            >
              {name}
            </div>
          </div>
        ))}
      </div>

      {/* On the dark sidebar surface, where half the set actually lives. */}
      <h2 className="font-display mt-10 text-lg text-navy-900">על רקע כהה</h2>
      <div className="mt-3 flex flex-wrap gap-4 rounded-2xl bg-navy-800 p-6 text-white/80">
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} size={20} />
        ))}
      </div>
    </div>
  );
}

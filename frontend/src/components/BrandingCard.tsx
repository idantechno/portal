import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../api/businesses";
import { apiErrorMessage } from "../api/client";
import type { Business } from "../api/types";
import { Button, Card, FormError, Input, Label, Spinner } from "./ui";
import { businessThemeVars, DEFAULT_BRANDING, normalizeHex } from "../lib/theme";
import {
  detectImageBackground,
  extractPaletteFromFile,
  fileToResizedDataUrl,
} from "../lib/image";
import { Icon } from "./icons";

interface Props {
  businessId: string;
  business: Business;
}

/** Roles the top-3 ranked colors fill (the rest are extra palette colors). */
const ROLE = ["ראשי", "משני", "הדגשה"];

export default function BrandingCard({ businessId, business }: Props) {
  const qc = useQueryClient();
  const b = business.branding ?? {};
  const seedPalette =
    b.palette && b.palette.length
      ? b.palette
      : [b.primaryColor, b.secondaryColor, b.accentColor].filter(
          (c): c is string => Boolean(c),
        );
  const [palette, setPalette] = useState<string[]>(
    seedPalette.length ? seedPalette : [...DEFAULT_BRANDING.palette],
  );
  // Drag-to-reorder state (native HTML5 DnD, swap semantics).
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [logo, setLogo] = useState<string | undefined>(b.logoUrl);
  const [logoBg, setLogoBg] = useState<string>(b.logoBgColor ?? "#ffffff");
  const [slogan, setSlogan] = useState(b.slogan ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "logo" | "palette">(null);
  const [saved, setSaved] = useState(false);

  // The top-3 ranked colors drive the whole app (theme + document designs);
  // extra palette colors are stored for richer designs later.
  const primary = normalizeHex(palette[0]) ?? DEFAULT_BRANDING.primaryColor;
  const secondary = normalizeHex(palette[1]) ?? primary;
  const accent = normalizeHex(palette[2]) ?? secondary;

  const setColor = (i: number, v: string) =>
    setPalette((p) => p.map((c, j) => (j === i ? v : c)));
  const addColor = () =>
    setPalette((p) => (p.length >= 5 ? p : [...p, "#64748b"]));
  const removeColor = (i: number) =>
    setPalette((p) => (p.length <= 1 ? p : p.filter((_, j) => j !== i)));
  // Swap two positions — the color that sat at `j` moves to `i` and vice versa.
  // This is both the drag-drop behaviour and the keyboard (arrow) reorder.
  const swap = (i: number, j: number) =>
    setPalette((p) => {
      if (i === j || i < 0 || j < 0 || i >= p.length || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  // A logo saved before this feature has no stored bg color — detect it once.
  useEffect(() => {
    if (logo && !b.logoBgColor) {
      void detectImageBackground(logo).then(setLogoBg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoInput = useRef<HTMLInputElement>(null);
  const paletteInput = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: () =>
      businessesApi.update(businessId, {
        branding: {
          palette: palette
            .map((c) => normalizeHex(c))
            .filter((c): c is string => Boolean(c)),
          primaryColor: primary,
          secondaryColor: secondary,
          accentColor: accent,
          logoUrl: logo,
          logoBgColor: logo ? normalizeHex(logoBg) ?? "#ffffff" : undefined,
          slogan: slogan.trim() || undefined,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["business", businessId] });
      void qc.invalidateQueries({ queryKey: ["businesses"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e) => setError(apiErrorMessage(e, "השמירה נכשלה")),
  });

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy("logo");
    try {
      const resized = await fileToResizedDataUrl(file);
      setLogo(resized);
      setLogoBg(await detectImageBackground(resized));
    } catch {
      setError("לא ניתן לטעון את הלוגו");
    } finally {
      setBusy(null);
    }
  }

  async function onPalette(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy("palette");
    try {
      const colors = await extractPaletteFromFile(file, 5);
      if (colors.length) {
        setPalette(colors);
      } else {
        setError("לא נמצאו צבעים בתמונה");
      }
    } catch {
      setError("לא ניתן לחלץ צבעים מהתמונה");
    } finally {
      setBusy(null);
    }
  }

  const previewVars = businessThemeVars({
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accent,
  });

  return (
    <Card className="p-6 mb-6">
      <h2 className="font-semibold mb-1">מיתוג ועיצוב</h2>
      <p className="text-xs text-navy-400 mb-4">
        הצבעים והלוגו מולבשים אוטומטית על הממשק של כל משתמשי העסק.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>צבעי המותג — לפי סדר העדפה</Label>
            {palette.map((c, i) => (
              <div
                key={i}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) setOverIndex(i);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) swap(dragIndex, i);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={`flex items-center gap-2 rounded-lg transition ${
                  dragIndex === i ? "opacity-40" : ""
                } ${
                  overIndex === i && dragIndex !== null && dragIndex !== i
                    ? "ring-2 ring-brand-300"
                    : ""
                }`}
              >
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      swap(i, i - 1);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      swap(i, i + 1);
                    }
                  }}
                  aria-label={`גרור לשינוי הסדר, צבע ${i + 1}. חצים מעלה ומטה מזיזים`}
                  className="grid h-9 w-6 shrink-0 cursor-grab place-items-center rounded text-navy-300 hover:bg-navy-50 hover:text-navy-500 active:cursor-grabbing"
                >
                  <Icon name="grip" size={16} />
                </button>
                <span className="w-14 shrink-0 text-xs text-navy-400">
                  {i + 1}. {ROLE[i] ?? "נוסף"}
                </span>
                <input
                  type="color"
                  value={normalizeHex(c) ?? "#000000"}
                  onChange={(e) => setColor(i, e.target.value)}
                  className="h-9 w-10 rounded-lg border border-navy-200 bg-white p-0.5 cursor-pointer shrink-0"
                  aria-label={`צבע ${i + 1}`}
                />
                <Input
                  value={c}
                  onChange={(e) => setColor(i, e.target.value)}
                  dir="ltr"
                  className="font-mono text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeColor(i)}
                  disabled={palette.length <= 1}
                  aria-label="הסר צבע"
                  className="grid h-8 w-7 place-items-center rounded-lg text-navy-400 hover:bg-navy-50 disabled:opacity-25"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
            {palette.length < 5 && (
              <button
                type="button"
                onClick={addColor}
                className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
              >
                <Icon name="plus" size={14} />
                הוסף צבע
              </button>
            )}
            <p className="text-xs text-navy-400">
              הצבע הראשון הוא הראשי; שלושת הראשונים בדירוג משמשים לממשק
              ולמסמכים. גרור מהידית כדי לשנות את הסדר — הצבע שהיה במקום היעד
              מתחלף עם הגרור. עד 5 צבעים.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => paletteInput.current?.click()}
              disabled={busy === "palette"}
              className="text-sm text-brand-700 hover:underline disabled:opacity-50"
            >
              {busy === "palette" ? (
                "מחלץ צבעים…"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="palette" size={15} />
                  חלץ צבעים מתמונה
                </span>
              )}
            </button>
            <input
              ref={paletteInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPalette}
            />
            <p className="text-xs text-navy-400 mt-1">
              העלה תמונת פלטה או צילום — המערכת תזהה את הצבעים.
            </p>
          </div>

          <div>
            <Label>לוגו</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="h-14 w-14 rounded-xl border border-navy-100 bg-cream-50 flex items-center justify-center overflow-hidden shrink-0">
                {logo ? (
                  <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-navy-300 text-xs">אין</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => logoInput.current?.click()}
                disabled={busy === "logo"}
                className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm hover:bg-cream-50 disabled:opacity-50"
              >
                {busy === "logo" ? "טוען…" : "העלה לוגו"}
              </button>
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo(undefined)}
                  className="text-sm text-navy-400 hover:text-coral-600"
                >
                  הסר
                </button>
              )}
              <input
                ref={logoInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onLogo}
              />
            </div>
          </div>

          {logo && (
            <div>
              <Label>רקע הלוגו</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={normalizeHex(logoBg) ?? "#ffffff"}
                  onChange={(e) => setLogoBg(e.target.value)}
                  className="h-9 w-10 rounded-lg border border-navy-200 bg-white p-0.5 cursor-pointer shrink-0"
                  aria-label="רקע הלוגו"
                />
                <Input
                  value={logoBg}
                  onChange={(e) => setLogoBg(e.target.value)}
                  dir="ltr"
                  className="font-mono text-sm w-32"
                />
                <button
                  type="button"
                  onClick={() =>
                    void detectImageBackground(logo).then(setLogoBg)
                  }
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-3 py-2 text-sm hover:bg-cream-50"
                >
                  <Icon name="palette" size={14} />
                  זהה מהלוגו
                </button>
              </div>
              <p className="text-xs text-navy-400 mt-1">
                הצבע שעליו יושב הלוגו במסמכים — נדגם ישירות מפיקסלי הלוגו כדי
                לשחזר את הגוון המדויק (כך אפקט הלוגו הצף עובד חלק). אפשר גם לתקן
                ידנית.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="brand-slogan">סלוגן</Label>
            <Input
              id="brand-slogan"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="פשוט ליצור."
              maxLength={140}
            />
          </div>
        </div>

        {/* Live preview — a full mini-mockup so every color role is visible. */}
        <div>
          <Label>תצוגה מקדימה</Label>
          <div
            style={previewVars}
            className="rounded-2xl overflow-hidden border border-navy-100"
          >
            <div className="grid grid-cols-[7rem_1fr]">
              {/* Sidebar — primary → derived sidebar shade */}
              <div
                className="p-3 text-white"
                style={{ backgroundColor: "var(--brand-sidebar)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  {logo ? (
                    <img
                      src={logo}
                      alt=""
                      className="h-7 w-7 rounded-lg object-contain bg-white/90 p-0.5"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-lg bg-white/15" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold truncate">
                      {business.name}
                    </div>
                    {slogan && (
                      <div className="text-[9px] text-white/50 truncate">
                        {slogan}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: "var(--brand-accent)",
                      color: "var(--brand-accent-contrast)",
                    }}
                  >
                    <Icon name="home" size={14} />
                    בית
                  </div>
                  <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-white/70">
                    <Icon name="chat" size={14} />
                    שיחות
                  </div>
                  <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-white/70">
                    <Icon name="agents" size={14} />
                    סוכנים
                  </div>
                </div>
              </div>

              {/* Content area — sits on the app's cream canvas */}
              <div className="app-canvas p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm text-navy-900">כותרת מסך</h3>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--brand-accent) 14%, transparent)",
                      color: "var(--brand-accent)",
                      borderColor:
                        "color-mix(in srgb, var(--brand-accent) 30%, transparent)",
                    }}
                  >
                    תגית
                  </span>
                </div>

                {/* Real card wash — driven by --brand-surface (= secondary) */}
                <div className="surface-card rounded-xl border p-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--brand-accent) 16%, transparent)",
                        color: "var(--brand-accent)",
                      }}
                    >
                      <Icon name="agents" size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-navy-900 truncate">
                        כרטיס בממשק
                      </div>
                      <div className="text-[10px] text-navy-400 truncate">
                        רקע הכרטיס נצבע בצבע המשני
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] leading-relaxed text-navy-500">
                  טקסט גוף לדוגמה, כדי לראות איך הצבעים יושבים על הקנבס הקרמי של
                  המערכת.
                </p>

                {/* Primary button — accent + accent-contrast */}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: "var(--brand-accent)",
                    color: "var(--brand-accent-contrast)",
                  }}
                >
                  <Icon name="plus" size={13} />
                  כפתור ראשי
                </button>
              </div>
            </div>
          </div>

          {/* Legend — maps each color to the role it plays */}
          <ul className="mt-3 space-y-1 text-[11px] text-navy-500">
            <li className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-sm border border-navy-100"
                style={{ backgroundColor: primary }}
              />
              ראשי → סיידבר וכותרות
            </li>
            <li className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-sm border border-navy-100"
                style={{ backgroundColor: secondary }}
              />
              משני → רקע הכרטיסים
            </li>
            <li className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-sm border border-navy-100"
                style={{ backgroundColor: accent }}
              />
              הדגשה → כפתורים, תגיות ומצב פעיל
            </li>
          </ul>
        </div>
      </div>

      <FormError message={error} />
      <div className="flex items-center gap-3 mt-5">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Spinner /> : "שמור מיתוג"}
        </Button>
        {saved && <span className="text-sm text-green-700">נשמר ✓</span>}
      </div>
    </Card>
  );
}

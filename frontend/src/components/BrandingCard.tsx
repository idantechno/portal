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

/** A small CSS-drawn up/down caret for the reorder buttons. */
function Caret({ dir }: { dir: "up" | "down" }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 0,
        height: 0,
        borderLeft: "4px solid transparent",
        borderRight: "4px solid transparent",
        ...(dir === "up"
          ? { borderBottom: "5px solid currentColor" }
          : { borderTop: "5px solid currentColor" }),
      }}
    />
  );
}

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
    seedPalette.length
      ? seedPalette
      : [
          DEFAULT_BRANDING.primaryColor,
          DEFAULT_BRANDING.secondaryColor,
          DEFAULT_BRANDING.accentColor,
        ],
  );
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
  const move = (i: number, d: -1 | 1) =>
    setPalette((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
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
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-navy-400">
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
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="הזז מעלה"
                    className="grid h-4 w-5 place-items-center rounded text-navy-400 hover:bg-navy-50 disabled:opacity-25"
                  >
                    <Caret dir="up" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === palette.length - 1}
                    aria-label="הזז מטה"
                    className="grid h-4 w-5 place-items-center rounded text-navy-400 hover:bg-navy-50 disabled:opacity-25"
                  >
                    <Caret dir="down" />
                  </button>
                </div>
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
              ולמסמכים. עד 5 צבעים.
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

        {/* Live preview */}
        <div>
          <Label>תצוגה מקדימה</Label>
          <div
            style={previewVars}
            className="rounded-2xl overflow-hidden border border-navy-100"
          >
            <div
              className="p-4 text-white"
              style={{ backgroundColor: "var(--brand-sidebar)" }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                {logo ? (
                  <img
                    src={logo}
                    alt=""
                    className="h-8 w-8 rounded-lg object-contain bg-white/90 p-0.5"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-white/15" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {business.name}
                  </div>
                  {slogan && (
                    <div className="text-[10px] text-white/50 truncate">
                      {slogan}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div
                  className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium"
                  style={{
                    backgroundColor: "var(--brand-accent)",
                    color: "var(--brand-accent-contrast)",
                  }}
                >
                  <Icon name="home" size={16} />
                  בית
                </div>
                <div className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-white/70">
                  <Icon name="chat" size={16} />
                  שיחות
                </div>
                <div className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-white/70">
                  <Icon name="agents" size={16} />
                  סוכנים
                </div>
              </div>
            </div>
          </div>
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

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../api/businesses";
import { apiErrorMessage } from "../api/client";
import type { Business } from "../api/types";
import { Button, Card, FormError, Input, Label, Spinner } from "./ui";
import { businessThemeVars, DEFAULT_BRANDING, normalizeHex } from "../lib/theme";
import { extractPaletteFromFile, fileToResizedDataUrl, mostSaturatedIndex } from "../lib/image";
import { Icon } from "./icons";

interface Props {
  businessId: string;
  business: Business;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={normalizeHex(value) ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 rounded-lg border border-navy-200 bg-white p-0.5 cursor-pointer shrink-0"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="ltr"
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}

export default function BrandingCard({ businessId, business }: Props) {
  const qc = useQueryClient();
  const b = business.branding ?? {};
  const [primary, setPrimary] = useState(
    b.primaryColor ?? DEFAULT_BRANDING.primaryColor,
  );
  const [secondary, setSecondary] = useState(
    b.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
  );
  const [accent, setAccent] = useState(
    b.accentColor ?? DEFAULT_BRANDING.accentColor,
  );
  const [logo, setLogo] = useState<string | undefined>(b.logoUrl);
  const [slogan, setSlogan] = useState(b.slogan ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "logo" | "palette">(null);
  const [saved, setSaved] = useState(false);

  const logoInput = useRef<HTMLInputElement>(null);
  const paletteInput = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: () =>
      businessesApi.update(businessId, {
        branding: {
          primaryColor: normalizeHex(primary) ?? DEFAULT_BRANDING.primaryColor,
          secondaryColor:
            normalizeHex(secondary) ?? DEFAULT_BRANDING.secondaryColor,
          accentColor: normalizeHex(accent) ?? DEFAULT_BRANDING.accentColor,
          logoUrl: logo,
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
      setLogo(await fileToResizedDataUrl(file));
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
      const colors = await extractPaletteFromFile(file, 3);
      if (colors.length) {
        const accentIdx = mostSaturatedIndex(colors);
        setAccent(colors[accentIdx]);
        const rest = colors.filter((_, i) => i !== accentIdx);
        if (rest[0]) setPrimary(rest[0]);
        if (rest[1]) setSecondary(rest[1]);
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <ColorField label="ראשי" value={primary} onChange={setPrimary} />
            <ColorField label="משני" value={secondary} onChange={setSecondary} />
            <ColorField label="הדגשה" value={accent} onChange={setAccent} />
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

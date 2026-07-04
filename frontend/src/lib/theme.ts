import type { CSSProperties } from "react";
import type { BusinessBranding } from "../api/types";

/**
 * Turns a business's saved branding (primary / secondary / accent + logo) into
 * CSS custom properties that the cockpit shell reads. The sidebar base is
 * always derived to a deep, contrast-safe shade of the primary color so white
 * text stays readable no matter what color the owner picks.
 */

// ---- Portal Studio defaults (also the seed values in the branding editor). ----
export const DEFAULT_BRANDING: Required<
  Pick<BusinessBranding, "primaryColor" | "secondaryColor" | "accentColor">
> = {
  primaryColor: "#011427",
  secondaryColor: "#6091B0",
  accentColor: "#DC5D46",
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function normalizeHex(input?: string | null): string | null {
  if (!input) return null;
  let h = input.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return `#${h.toLowerCase()}`;
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace(/^#/, "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const to = (n: number) =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/** Relative luminance (WCAG) for choosing readable text on a fill. */
function luminance({ r, g, b }: Rgb): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/** White or near-black — whichever reads better on the given fill. */
export function readableText(hex: string): string {
  return luminance(hexToRgb(hex)) > 0.5 ? "#0f172a" : "#ffffff";
}

/** Deep, hue-preserving shade of the primary — the sidebar/header base. */
function sidebarBase(hex: string): string {
  const { h, s } = rgbToHsl(hexToRgb(hex));
  // Keep the hue, ensure it's dark enough for white text and richly saturated.
  return rgbToHex(hslToRgb(h, clamp(s, 0.25, 0.7), 0.13));
}

/**
 * Build the inline `style` object of CSS variables for a themed subtree.
 * Falls back to the Portal palette when a field is missing/invalid.
 */
export function businessThemeVars(
  branding?: BusinessBranding | null,
): CSSProperties {
  const primary = normalizeHex(branding?.primaryColor) ?? DEFAULT_BRANDING.primaryColor;
  const secondary =
    normalizeHex(branding?.secondaryColor) ?? DEFAULT_BRANDING.secondaryColor;
  const accent = normalizeHex(branding?.accentColor) ?? DEFAULT_BRANDING.accentColor;
  const sidebar = sidebarBase(primary);

  const vars: Record<string, string> = {
    "--brand-primary": primary,
    "--brand-secondary": secondary,
    "--brand-accent": accent,
    "--brand-accent-contrast": readableText(accent),
    "--brand-sidebar": sidebar,
    "--brand-on-sidebar": readableText(sidebar),
  };
  return vars as CSSProperties;
}

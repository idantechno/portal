/**
 * Client-side image helpers for branding: shrink an uploaded logo to a small
 * data URI, and pull a color palette out of an uploaded palette/logo image.
 * All runs in the browser — no upload round-trip needed to preview.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("FILE_READ_FAILED"));
    fr.readAsDataURL(file);
  });
}

/** Shrink an image file to a PNG data URI no larger than `maxDim` px a side. */
export async function fileToResizedDataUrl(
  file: File,
  maxDim = 420,
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Extract up to `count` representative colors from an image file. Coarse-
 * quantizes pixels, drops near-white/near-black background, and greedily keeps
 * colors that are visually distinct from those already chosen.
 */
export async function extractPaletteFromFile(
  file: File,
  count = 3,
): Promise<string[]> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, 100 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const buckets = new Map<
    number,
    { r: number; g: number; b: number; n: number }
  >();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Drop near-white and near-black — usually background, not brand.
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 16 && g < 16 && b < 16) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const cur = buckets.get(key);
    if (cur) {
      cur.r += r;
      cur.g += g;
      cur.b += b;
      cur.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  const colors = Array.from(buckets.values())
    .map((c) => ({
      r: Math.round(c.r / c.n),
      g: Math.round(c.g / c.n),
      b: Math.round(c.b / c.n),
      n: c.n,
    }))
    .sort((a, b) => b.n - a.n);

  const chosen: { r: number; g: number; b: number }[] = [];
  const far = (c: { r: number; g: number; b: number }) =>
    chosen.every((x) => {
      const d =
        Math.abs(x.r - c.r) + Math.abs(x.g - c.g) + Math.abs(x.b - c.b);
      return d > 60;
    });
  for (const c of colors) {
    if (chosen.length >= count) break;
    if (far(c)) chosen.push(c);
  }
  // If everything clustered together, fall back to the top buckets as-is.
  while (chosen.length < count && colors[chosen.length]) {
    chosen.push(colors[chosen.length]);
  }

  return chosen.map((c) => toHex(c.r, c.g, c.b));
}

/** Index of the most saturated color in a hex list (for picking an accent). */
export function mostSaturatedIndex(hexes: string[]): number {
  let best = 0;
  let bestS = -1;
  hexes.forEach((hex, i) => {
    const h = hex.replace(/^#/, "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const s = saturation(r, g, b);
    if (s > bestS) {
      bestS = s;
      best = i;
    }
  });
  return best;
}

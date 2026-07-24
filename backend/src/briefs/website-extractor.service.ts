import * as dns from 'node:dns/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ClaudeJsonService } from './claude-json.service';
import { UNKNOWN } from './brief-facts';

/** 🟢 Everything the extraction step can pull off the public web. */
export interface WebExtraction {
  /** Pages actually read, for the brief's source note. */
  pages: string[];
  services: string[];
  pricing: string;
  tone: string;
  toneWords: string[];
  testimonials: string[];
  proofAssets: string[];
  digitalPresence: string[];
  story: string;
  processSteps: string[];
  faq: string[];
  customerLanguage: string[];
  geography: string;
  notes: string;
}

export const EMPTY_EXTRACTION: WebExtraction = {
  pages: [],
  services: [],
  pricing: UNKNOWN,
  tone: UNKNOWN,
  toneWords: [],
  testimonials: [],
  proofAssets: [],
  digitalPresence: [],
  story: UNKNOWN,
  processSteps: [],
  faq: [],
  customerLanguage: [],
  geography: UNKNOWN,
  notes: '',
};

const MAX_PAGES = 5;
const MAX_BYTES = 900_000;
const MAX_TEXT_PER_PAGE = 14_000;
const FETCH_TIMEOUT_MS = 15_000;

/** Same-origin paths worth reading beyond the homepage, in priority order. */
const INTERESTING = [
  'about',
  'אודות',
  'services',
  'שירותים',
  'service',
  'products',
  'מוצרים',
  'price',
  'pricing',
  'מחיר',
  'מחירון',
  'packages',
  'חבילות',
  'testimonial',
  'reviews',
  'המלצות',
  'portfolio',
  'gallery',
  'faq',
  'שאלות',
  'contact',
  'צור-קשר',
];

const SYSTEM_PROMPT = `אתה שלב ה"חילוץ" בבניית בריף שיווקי לעסק. אתה מקבל טקסט גולמי שנקרא מאתר האינטרנט של העסק, ומחלץ ממנו רק מה שכתוב שם בפועל.

חוקי ברזל:
- אסור להמציא. אם מידע לא מופיע בטקסט — החזר "${UNKNOWN}" (למחרוזת) או מערך ריק (לרשימה). לעולם אל תשלים מהידע הכללי שלך על התחום.
- אל תנסח מסרים שיווקיים, אל תשפר ואל תמליץ. אתה מדווח מה קיים, לא מה כדאי.
- ציטוטים (המלצות, שפת לקוחות) — העתק כלשונם, בלי לערוך.
- מחירים — רק אם מספר מופיע בפועל בטקסט. אחרת "${UNKNOWN}".
- כששדה אינו ידוע — החזר בדיוק "${UNKNOWN}" ותו לא. בלי הסברים ובלי מידע חלקי בסוגריים.
- ענה בעברית, למעט שמות/כתובות שמופיעים בלועזית.

החזר JSON יחיד בלבד, ללא טקסט נוסף, במבנה:
{
  "services": string[],          // שירותים/מוצרים כפי שהאתר מציג אותם
  "pricing": string,             // טווחי מחיר/חבילות אם מפורסמים
  "tone": string,                // תיאור טון הכתיבה באתר (משפט–שניים)
  "toneWords": string[],         // עד 3 מילים שמתארות את הטון
  "testimonials": string[],      // ציטוטי לקוחות כלשונם
  "proofAssets": string[],       // מספרים, ותק, לקוחות מוכרים, תעודות, אזכורים
  "digitalPresence": string[],   // קישורים/רשתות שמופיעים באתר
  "story": string,               // סיפור העסק / "עלינו" בתמצית, על בסיס הטקסט בלבד
  "processSteps": string[],      // שלבי תהליך העבודה אם מתוארים
  "faq": string[],               // שאלות נפוצות כפי שמופיעות
  "customerLanguage": string[],  // ניסוחים שבהם האתר מתאר את הבעיה של הלקוח
  "geography": string,           // אזור פעילות אם מצוין
  "notes": string                // הערה קצרה על מה שלא נמצא באתר
}`;

/**
 * 🟢 The extraction layer: reads the business's own website and reports what is
 * actually written there.
 *
 * Two independent guards keep this honest. The fetcher refuses anything that
 * isn't a public http(s) host (an operator-supplied URL must not become an
 * SSRF probe into the cluster), and the prompt forbids filling gaps from the
 * model's own knowledge — a missing fact comes back as ⟨לא ידוע⟩ and travels
 * to the brief that way.
 */
@Injectable()
export class WebsiteExtractorService {
  private readonly log = new Logger(WebsiteExtractorService.name);

  constructor(private readonly claude: ClaudeJsonService) {}

  async extract(rawUrl: string | null | undefined): Promise<WebExtraction> {
    const start = this.normalizeUrl(rawUrl);
    if (!start) return { ...EMPTY_EXTRACTION };

    const pages = await this.crawl(start);
    if (pages.length === 0) {
      this.log.warn(`no readable pages at ${start.href}`);
      return {
        ...EMPTY_EXTRACTION,
        notes: `לא הצלחנו לקרוא את ${start.href}`,
      };
    }

    const corpus = pages
      .map((p) => `=== ${p.url} ===\n${p.text}`)
      .join('\n\n')
      .slice(0, 60_000);

    const parsed = await this.claude.json<Partial<WebExtraction>>({
      system: SYSTEM_PROMPT,
      user: `להלן הטקסט שנקרא מהאתר של העסק. חלץ ממנו את המידע לפי המבנה.\n\n${corpus}`,
      maxTokens: 4000,
    });

    if (!parsed) {
      return {
        ...EMPTY_EXTRACTION,
        pages: pages.map((p) => p.url),
        notes: 'החילוץ מהאתר נכשל — יש להשלים ידנית.',
      };
    }

    return {
      pages: pages.map((p) => p.url),
      services: strArray(parsed.services),
      pricing: str(parsed.pricing),
      tone: str(parsed.tone),
      toneWords: strArray(parsed.toneWords).slice(0, 3),
      testimonials: strArray(parsed.testimonials),
      proofAssets: strArray(parsed.proofAssets),
      digitalPresence: strArray(parsed.digitalPresence),
      story: str(parsed.story),
      processSteps: strArray(parsed.processSteps),
      faq: strArray(parsed.faq),
      customerLanguage: strArray(parsed.customerLanguage),
      geography: str(parsed.geography),
      notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
    };
  }

  /** http(s) + a public host only. Returns null for anything we won't fetch. */
  private normalizeUrl(raw: string | null | undefined): URL | null {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return null;
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    try {
      const url = new URL(withScheme);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      if (!url.hostname || url.hostname === 'localhost') return null;
      return url;
    } catch {
      return null;
    }
  }

  /** Blocks loopback / link-local / private-range targets before any request. */
  private async isPublicHost(hostname: string): Promise<boolean> {
    try {
      const records = await dns.lookup(hostname, { all: true });
      if (records.length === 0) return false;
      return records.every((r) => !isPrivateAddress(r.address));
    } catch {
      return false;
    }
  }

  private async crawl(
    start: URL,
  ): Promise<Array<{ url: string; text: string }>> {
    if (!(await this.isPublicHost(start.hostname))) {
      this.log.warn(`refusing to fetch non-public host ${start.hostname}`);
      return [];
    }

    const home = await this.fetchText(start.href);
    if (!home) return [];

    const pages = [{ url: start.href, text: htmlToText(home) }];
    const links = this.pickLinks(home, start);
    for (const link of links) {
      if (pages.length >= MAX_PAGES) break;
      const html = await this.fetchText(link);
      if (!html) continue;
      pages.push({ url: link, text: htmlToText(html) });
    }
    return pages.filter((p) => p.text.length > 40);
  }

  /** Same-origin links whose path looks like an about/services/pricing page. */
  private pickLinks(html: string, base: URL): string[] {
    const found = new Set<string>();
    const re = /href\s*=\s*["']([^"'#]+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let url: URL;
      try {
        url = new URL(m[1], base);
      } catch {
        continue;
      }
      if (url.origin !== base.origin) continue;
      if (url.href === base.href) continue;
      if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|mp4|css|js)$/i.test(url.pathname))
        continue;
      const path = decodeURIComponent(url.pathname).toLowerCase();
      if (!INTERESTING.some((k) => path.includes(k))) continue;
      url.hash = '';
      found.add(url.href);
      if (found.size >= 12) break;
    }
    return [...found].slice(0, MAX_PAGES - 1);
  }

  private async fetchText(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          // Some hosts serve a bare challenge page to unknown agents.
          'user-agent':
            'Mozilla/5.0 (compatible; PortalStudioBriefBot/1.0; +https://portalstudio.co.il)',
          accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const type = res.headers.get('content-type') ?? '';
      if (type && !type.includes('html') && !type.includes('text')) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.subarray(0, MAX_BYTES).toString('utf8');
    } catch (err) {
      this.log.debug(`fetch failed ${url}: ${(err as Error).message}`);
      return null;
    }
  }
}

function str(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : UNKNOWN;
}
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x && x !== UNKNOWN);
}

/** RFC1918 + loopback + link-local + CGNAT + IPv6 unique-local. */
function isPrivateAddress(address: string): boolean {
  if (address.includes(':')) {
    const v6 = address.toLowerCase();
    if (v6 === '::1' || v6 === '::') return true;
    if (v6.startsWith('fe80') || v6.startsWith('fc') || v6.startsWith('fd'))
      return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** Strips markup down to readable text — good enough to feed a model. */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      // Spaces, tabs and NBSP — but not newlines, which carry the block structure.
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, MAX_TEXT_PER_PAGE)
  );
}

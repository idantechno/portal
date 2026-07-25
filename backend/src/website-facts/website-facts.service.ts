import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { WebsiteExtractorService } from '../briefs/website-extractor.service';
import { ContextFilesService } from '../context-files/context-files.service';

const UNKNOWN = '⟨לא ידוע⟩';
const FACTS_FILE = 'website-facts.md';
const HIDDEN_FACTS_PATH = `_hidden/${FACTS_FILE}`;

/** Hard facts pulled off the business's own site — the kind an agent needs to
 *  answer a customer: what it costs, when it's open, where it is, how to get
 *  there. Every field is only what's written on the site; missing => UNKNOWN. */
interface WebsiteFacts {
  products: string[];
  packages: string[];
  pricing: string[];
  hours: string;
  address: string;
  location: string;
  directions: string;
  phone: string;
  email: string;
  payment: string;
  other: string[];
  notes: string;
}

const SYSTEM_PROMPT = `אתה מחלץ **עובדות בלבד** מטקסט שנקרא מאתר האינטרנט של עסק. המטרה: מסמך מידע שסוכן שירות ישתמש בו כדי לענות ללקוחות (מחירים, שעות, מיקום, הגעה, חבילות, מוצרים).

חוקי ברזל:
- אסור להמציא. אם עובדה לא מופיעה בטקסט — החזר "${UNKNOWN}" (למחרוזת) או מערך ריק (לרשימה). לעולם אל תשלים מהידע הכללי שלך.
- מחירים/מספרים — רק אם הם מופיעים בפועל בטקסט. אחרת "${UNKNOWN}".
- העתק עובדות כלשונן; אל תשווק, אל תשפר, אל תפרש.
- ענה בעברית, למעט שמות/כתובות/מספרים שמופיעים בלועזית.

החזר JSON יחיד בלבד, ללא טקסט נוסף, במבנה:
{
  "products": string[],     // מוצרים/שירותים עם תיאור קצר כפי שמופיע
  "packages": string[],     // מסלולים/חבילות
  "pricing": string[],      // מחירים ספציפיים — כל פריט: "מה — כמה"
  "hours": string,          // שעות פעילות
  "address": string,        // כתובת פיזית מלאה
  "location": string,       // עיר/אזור פעילות
  "directions": string,     // הוראות הגעה / חניה / תחבורה ציבורית
  "phone": string,          // טלפון
  "email": string,          // אימייל
  "payment": string,        // אמצעי/תנאי תשלום
  "other": string[],        // עובדות נוספות חשובות שלא נכנסו לקטגוריות
  "notes": string           // הערה קצרה על מה לא נמצא באתר
}`;

@Injectable()
export class WebsiteFactsService {
  private readonly log = new Logger(WebsiteFactsService.name);

  constructor(
    private readonly extractor: WebsiteExtractorService,
    private readonly claude: ClaudeJsonService,
    private readonly files: ContextFilesService,
  ) {}

  /**
   * Crawls the business's site, extracts hard facts, and writes them to
   * `_hidden/website-facts.md` (operator-authoritative context). Overwrites the
   * file on re-import so it stays a single, refreshable source.
   */
  async importFacts(
    businessId: string,
    userId: string,
    rawUrl: string,
  ): Promise<{ fileId: string; path: string; pages: string[] }> {
    if (!this.claude.configured) {
      throw new ServiceUnavailableException(
        'חילוץ מהאתר אינו מוגדר (חסר מפתח API).',
      );
    }

    const pages = await this.extractor.readPages(rawUrl);
    if (pages.length === 0) {
      throw new BadRequestException(
        'לא הצלחנו לקרוא את האתר. ודא שהכתובת נכונה ושהאתר ציבורי.',
      );
    }

    const corpus = pages
      .map((p) => `=== ${p.url} ===\n${p.text}`)
      .join('\n\n')
      .slice(0, 60_000);

    const facts = await this.claude.json<Partial<WebsiteFacts>>({
      system: SYSTEM_PROMPT,
      user: `להלן הטקסט שנקרא מהאתר של העסק. חלץ ממנו את העובדות לפי המבנה.\n\n${corpus}`,
      maxTokens: 4000,
    });
    if (!facts) {
      throw new ServiceUnavailableException(
        'חילוץ העובדות מהאתר נכשל. נסה שוב מאוחר יותר.',
      );
    }

    const markdown = renderFacts(
      facts,
      pages.map((p) => p.url),
      rawUrl,
    );

    // Single, refreshable file: overwrite if it already exists, else create.
    const existing = (await this.files.list(businessId, true)).find(
      (f) => f.relativePath === HIDDEN_FACTS_PATH,
    );
    const saved = existing
      ? await this.files.updateContent(businessId, existing.id, markdown)
      : await this.files.createTextFile({
          businessId,
          uploadedByUserId: userId,
          path: FACTS_FILE,
          content: markdown,
          hidden: true,
          mimeType: 'text/markdown',
        });

    this.log.log(
      `Website facts imported for business ${businessId} from ${rawUrl} (${pages.length} pages)`,
    );
    return {
      fileId: saved.id,
      path: saved.relativePath,
      pages: pages.map((p) => p.url),
    };
  }
}

function line(label: string, value: string): string {
  const v = value && value.trim() ? value.trim() : UNKNOWN;
  return `- **${label}:** ${v}`;
}

function bulletList(label: string, items: string[]): string {
  const clean = (items ?? [])
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x && x !== UNKNOWN);
  if (clean.length === 0) return `### ${label}\n${UNKNOWN}`;
  return `### ${label}\n${clean.map((x) => `- ${x}`).join('\n')}`;
}

/** Deterministic markdown — the model only fills values, the layout is fixed. */
function renderFacts(
  f: Partial<WebsiteFacts>,
  pages: string[],
  sourceUrl: string,
): string {
  const str = (v: unknown) =>
    typeof v === 'string' && v.trim() ? v.trim() : UNKNOWN;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

  const sources = pages.length
    ? pages.map((u) => `- ${u}`).join('\n')
    : `- ${sourceUrl}`;

  return [
    '# עובדות מהאתר',
    '',
    `> נוצר אוטומטית מהאתר ${sourceUrl} — **טעון בדיקה ואישור**. עדכן/מחק שורות לא מדויקות. ניתן לרענן בכל עת מכפתור "ייבא עובדות מהאתר".`,
    '',
    '## פרטים כלליים',
    line('מיקום', str(f.location)),
    line('כתובת', str(f.address)),
    line('הגעה / חניה', str(f.directions)),
    line('שעות פעילות', str(f.hours)),
    line('טלפון', str(f.phone)),
    line('אימייל', str(f.email)),
    line('תשלום', str(f.payment)),
    '',
    bulletList('מחירים', arr(f.pricing)),
    '',
    bulletList('חבילות / מסלולים', arr(f.packages)),
    '',
    bulletList('מוצרים / שירותים', arr(f.products)),
    '',
    bulletList('עובדות נוספות', arr(f.other)),
    '',
    '---',
    `*מקורות שנקראו:*\n${sources}`,
    typeof f.notes === 'string' && f.notes.trim()
      ? `\n*הערת החילוץ:* ${f.notes.trim()}`
      : '',
    '',
  ].join('\n');
}

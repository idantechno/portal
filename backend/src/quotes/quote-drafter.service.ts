import { Injectable, Logger } from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { renderOnboardingProfile } from '../agents/onboarding-context';
import { QuoteLineItem } from './quote.entity';

export interface QuoteDraft {
  intro: string;
  lineItems: QuoteLineItem[];
  terms: string;
}

interface RawDraft {
  intro?: string;
  lineItems?: { name?: string; description?: string }[];
  terms?: string;
}

/**
 * Drafts a quote tailored to the BUSINESS's character — the point of the whole
 * change: a web studio gets design/development lines, a clinic gets treatments,
 * a marketer gets channels — driven by the business's onboarding profile (the
 * same profile that feeds the chat agent). It NEVER sets prices: line items
 * come back with an empty `amount` for the operator to fill. Returns null on any
 * failure so the caller falls back to a blank form rather than invented text.
 */
@Injectable()
export class QuoteDrafterService {
  private readonly log = new Logger(QuoteDrafterService.name);

  constructor(
    private readonly businesses: BusinessesService,
    private readonly claude: ClaudeJsonService,
  ) {}

  async draft(businessId: string, brief: string): Promise<QuoteDraft | null> {
    const business = await this.businesses.findById(businessId);
    if (!business) return null;
    const profile = renderOnboardingProfile(business);

    const system = `You draft a professional price quote ("הצעת מחיר") that a business sends to its customer. Tailor it to THIS business's character and field: a web/design studio quotes discovery/design/development/CMS/support lines; a clinic quotes treatments or packages; a marketer quotes channels; a consultant quotes phases — and so on. Read the business profile and infer the right kind of line items.

The input may be a short brief OR pasted existing content (an old quote, notes, an email). Either way, extract and structure it into the JSON below, tailored to the business.

Hard rules:
- Write everything in Hebrew.
- \`intro\` is ONE short paragraph of overall scope ONLY. Each concrete deliverable MUST be a separate object in \`lineItems\` — NEVER list deliverables inside \`intro\`.
- Produce concise, realistic line items that fit both what is being quoted AND the kind of business. Prefer 3–7 items.
- NEVER include, guess, or imply prices, amounts, or budgets. Pricing is the operator's decision — leave all money out entirely.
- Ground the work in the business profile below; do not invent facts about the business or the customer.

Return ONLY a JSON object of exactly this shape (no prose, no code fences):
{
  "intro": "<1 short paragraph of overall scope — NO deliverable lists>",
  "lineItems": [ { "name": "<short item name>", "description": "<what it covers>" } ],
  "terms": "<short terms: validity of the quote, payment stages, notes — still NO prices>"
}

Example (for a brief "בניית אתר תדמית למסעדה"):
{
  "intro": "בניית אתר תדמית למסעדה, מותאם למובייל, שמציג את הקונספט, התפריט ופרטי ההזמנה.",
  "lineItems": [
    { "name": "אפיון ואסטרטגיה", "description": "פגישת אפיון, מיפוי עמודים ומסרים מרכזיים." },
    { "name": "עיצוב UI/UX", "description": "עיצוב ויזואלי לכל עמודי האתר בהתאמה למותג." },
    { "name": "פיתוח ובנייה", "description": "בניית האתר מותאם למובייל עם מערכת ניהול תוכן." },
    { "name": "העלאה לאוויר", "description": "חיבור דומיין, בדיקות ופרסום האתר." }
  ],
  "terms": "ההצעה בתוקף ל-30 יום. תשלום ב-2 פעימות: מקדמה בתחילת העבודה ויתרה בהעלאה לאוויר."
}
Note how \`intro\` stays a single scope sentence and every deliverable is its own line item — never inside intro.`;

    const profileBlock = profile ? `\n\nBusiness profile:\n${profile}` : '';
    const user = `Draft a quote for: ${brief.trim()}${profileBlock}`;

    const raw = await this.claude.json<RawDraft>({
      system,
      user,
      maxTokens: 2000,
      timeoutMs: 120_000,
    });
    if (!raw) {
      this.log.warn(`quote draft returned null for business ${businessId}`);
      return null;
    }

    return {
      intro: String(raw.intro ?? '').trim(),
      lineItems: (raw.lineItems ?? [])
        .filter((x) => x && (x.name || x.description))
        .map((x) => ({
          name: String(x.name ?? '')
            .trim()
            .slice(0, 160),
          description: String(x.description ?? '')
            .trim()
            .slice(0, 2000),
          // Prices are ALWAYS operator-filled — the model never sets them.
          amount: '',
        })),
      terms: String(raw.terms ?? '').trim(),
    };
  }
}

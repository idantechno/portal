import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { PlansService } from '../plans/plans.service';
import { QuotesService } from '../quotes/quotes.service';
import { renderQuote } from '../quotes/quote-renderer';
import { ObjectivesService } from '../objectives/objectives.service';
import { Campaign } from './campaign.entity';

/** One asset to produce. */
export interface ProductionItem {
  /** וידאו / תמונה / מודעה / טקסט / … */
  kind: string;
  title: string;
  /** The creative idea — what it actually is. */
  description: string;
  /** Format, e.g. "ריל אנכי 9:16" / "פוסט 1:1" / "מאמר". */
  format: string;
  /** Versions/variants needed, e.g. "2 גרסאות אורך" / "3 וריאציות כותרת". */
  versions: string;
}

export interface ProductionPlanDraft {
  /** The creative through-line — echoes the owner's answers in one line. */
  concept: string;
  items: ProductionItem[];
  notes: string[];
}

const EMPTY_PRODUCTION: ProductionPlanDraft = {
  concept: '⟨לא ידוע⟩',
  items: [],
  notes: [],
};

const SYSTEM_PROMPT = `אתה מנהל הפקה יצירתי. אתה מקבל תוכנית שיווק מאושרת של לקוח, הקשר נוסף (יעדים, ערוצים ותקציב אם צורפו), ו**שלוש תשובות של בעל העסק** על הכיוון היצירתי. אתה מייצר **תוכנית הפקה** — רשימת הנכסים שצריך לייצר לקמפיין: סרטונים, תמונות, מודעות, טקסטים, עם הפורמט והגרסאות של כל אחד.

עקרונות — חובה:
1. **הקול האנושי מוביל.** שלוש התשובות של בעל העסק הן הליבה היצירתית — הסגנון שבחר, הסצנה שדמיין, ומידת נוכחות הלקוח. כל פריט חייב להרגיש כמו המשך של מה שהוא אמר, לא תבנית גנרית.
2. **מבוסס על התוכנית.** סוג ומספר הנכסים נגזרים מהערוצים והמשימות שבתוכנית (ומהתקציב אם צורף). אל תמציא ערוצים שאין להם עוגן.
3. **יצירתי וקונקרטי.** כל פריט = רעיון ברור שאפשר להפיק, לא כותרת מעורפלת. פורמט מדויק (יחס, אורך) וגרסאות אמיתיות.
4. **מכבד את נוכחות הלקוח.** אם בעל העסק אמר שהלקוח פחות מעוניין להופיע — תכנן נכסים שלא תלויים בו (מוצר, טקסט, אנימציה). אם מעוניין — נצל אותו.
5. **בלי המצאות עובדתיות.** אל תמציא תוצאות/מספרים/הבטחות. הרעיון היצירתי כן שלך — אבל עובדות רק ממה שנמסר.

סגנון: עברית נקייה. פריט חד ומעורר עדיף על פסקה.

החזר JSON יחיד בלבד, במבנה המדויק:
{
  "concept": string,                    // הקו היצירתי המרכזי במשפט — משקף את תשובות בעל העסק
  "items": [{                           // רשימת הנכסים לייצור
    "kind": string,                     // וידאו / תמונה / מודעה / טקסט / קרוסלה / ...
    "title": string,                    // שם קצר לנכס
    "description": string,              // הרעיון — מה מייצרים בפועל
    "format": string,                   // פורמט: יחס/אורך/סוג (למשל "ריל 9:16 עד 30ש׳")
    "versions": string                  // גרסאות/וריאציות נדרשות
  }],
  "notes": string[]                     // הערות הפקה (טון, מוזיקה, לוקיישן, קו ויזואלי…)
}`;

/**
 * Stage B of a campaign: turns the marketing plan + the owner's three creative
 * answers into a production plan (the asset list). The answers are required —
 * the human voice must be present before anything is generated.
 */
@Injectable()
export class ProductionPlanService {
  private readonly log = new Logger(ProductionPlanService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaigns: Repository<Campaign>,
    private readonly plans: PlansService,
    private readonly quotes: QuotesService,
    private readonly objectives: ObjectivesService,
    private readonly claude: ClaudeJsonService,
  ) {}

  async generate(businessId: string, campaign: Campaign): Promise<Campaign> {
    const answers = campaign.productionAnswers;
    if (
      !answers ||
      !answers.style?.trim() ||
      !answers.firstScene?.trim() ||
      !answers.clientPresence?.trim()
    ) {
      throw new BadRequestException(
        'צריך לענות על שלוש השאלות לפני הפקת תוכנית ההפקה.',
      );
    }
    if (!campaign.marketingPlanId) {
      throw new BadRequestException('לקמפיין אין תוכנית מקושרת.');
    }

    const plan = await this.plans.findByIdScoped(
      businessId,
      campaign.marketingPlanId,
    );
    if (!plan) throw new NotFoundException('Plan not found');

    // Optional context — used if the customer already has these approved.
    const [quotes, objectives] = await Promise.all([
      this.quotes.list(businessId, campaign.customerId),
      this.objectives.list(businessId, campaign.customerId),
    ]);
    const approvedQuote = quotes.find((q) => q.status === 'approved');
    const approvedObjectiveMeta = objectives.find(
      (o) => o.status === 'approved',
    );
    const approvedObjective = approvedObjectiveMeta
      ? await this.objectives.findByIdScoped(
          businessId,
          approvedObjectiveMeta.id,
        )
      : null;

    const draft = this.claude.configured
      ? await this.draft({
          planMarkdown: plan.markdown,
          quoteMarkdown: approvedQuote ? renderQuote(approvedQuote) : null,
          objectivesMarkdown: approvedObjective?.markdown ?? null,
          answers,
        })
      : { ...EMPTY_PRODUCTION };

    campaign.productionPlan = {
      draft,
      generatedAt: new Date().toISOString(),
      model: this.claude.model,
    };
    this.log.log(
      `production plan generated campaign=${campaign.id} items=${draft.items.length}`,
    );
    return this.campaigns.save(campaign);
  }

  private async draft(input: {
    planMarkdown: string;
    quoteMarkdown: string | null;
    objectivesMarkdown: string | null;
    answers: { style: string; firstScene: string; clientPresence: string };
  }): Promise<ProductionPlanDraft> {
    const user = [
      '=== התוכנית המאושרת (מקור-אמת) ===',
      input.planMarkdown.trim(),
      ...(input.objectivesMarkdown
        ? ['', '=== יעדים ומטרות ===', input.objectivesMarkdown.trim()]
        : []),
      ...(input.quoteMarkdown
        ? ['', '=== הצעת המחיר (ערוצים ותקציב) ===', input.quoteMarkdown.trim()]
        : []),
      '',
      '=== תשובות בעל העסק (הליבה היצירתית — הובל מהן) ===',
      `1. הסגנון שקפץ לו לראש: ${input.answers.style.trim()}`,
      `2. הסצנה/התוכן הראשון שדמיין: ${input.answers.firstScene.trim()}`,
      `3. מידת נוכחות הלקוח במדיה: ${input.answers.clientPresence.trim()}`,
      '',
      'בנה תוכנית הפקה לפי המבנה. תן לתשובות של בעל העסק להוביל את הכיוון היצירתי.',
    ].join('\n');

    const parsed = await this.claude.json<Partial<ProductionPlanDraft>>({
      system: SYSTEM_PROMPT,
      user,
      maxTokens: 6000,
    });
    if (!parsed) {
      this.log.warn('production drafting produced nothing — empty draft');
      return { ...EMPTY_PRODUCTION };
    }
    return {
      concept: str(parsed.concept),
      items: items(parsed.items),
      notes: strArray(parsed.notes),
    };
  }
}

function str(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : '⟨לא ידוע⟩';
}
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x && x !== '⟨לא ידוע⟩');
}
function items(v: unknown): ProductionItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (i): i is Record<string, unknown> => Boolean(i) && typeof i === 'object',
    )
    .map((i) => ({
      kind: str(i.kind),
      title: str(i.title),
      description: str(i.description),
      format: str(i.format),
      versions: str(i.versions),
    }))
    .slice(0, 40);
}

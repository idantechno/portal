import { Injectable, Logger } from '@nestjs/common';
import { ClaudeJsonService } from '../briefs/claude-json.service';

export const UNKNOWN = '⟨לא ידוע⟩';

export interface MetricRow {
  metric: string;
  target: string;
}

/** 🟠 The three sections of a goals-&-objectives doc. All of it is a draft. */
export interface ObjectiveDraft {
  /* 1 · מטרות הקמפיין */
  goals: string[];
  /* 2 · מדדי הצלחה */
  metrics: MetricRow[];
  /* 3 · קהל יעד */
  audience: string;
  audienceSegments: string[];
}

export const EMPTY_OBJECTIVE: ObjectiveDraft = {
  goals: [],
  metrics: [],
  audience: UNKNOWN,
  audienceSegments: [],
};

const SYSTEM_PROMPT = `אתה מנהל שיווק בכיר. אתה מקבל **בריף עסקי מאושר** (מסמך מקור-אמת שכבר עבר אישור אנושי) ומייצר ממנו מסמך קצר וממוקד של **יעדים ומטרות** לקראת קמפיין — מסמך שהלקוח יאשר לפני שממשיכים.

המסמך בנוי משלושה חלקים בלבד:
1. **מטרות הקמפיין** — מה הקמפיין אמור להשיג בפועל (לא סיסמאות — יעדים שאפשר לפעול לפיהם).
2. **מדדי הצלחה** — איך נדע שהצלחנו: כל מדד עם יעד מספרי/ברור ככל שהבריף מאפשר.
3. **קהל יעד** — למי פונים, מנוסח מהבריף.

עקרונות — חובה:
1. **הכול נגזר מהבריף.** אל תמציא יעדים, מספרים או קהלים שלא עולים מהבריף. מה שאין — "${UNKNOWN}" למחרוזת, מערך ריק לרשימה.
2. **ממוקד ומעשי.** מעט יעדים חדים עדיפים על רשימה ארוכה ומעורפלת. מדד שמזיז את המחט עדיף על מדד-סרק.
3. **כן לגבי מספרים.** אם הבריף נותן יעד/קיבולת/תקציב — גזור מדדים ריאליים מהם. אם אין נתון, אל תמציא יעד מספרי — כתוב מדד איכותני.
4. **טיוטה.** המסמך יעבור אישור הלקוח לפני המשך.

סגנון: עברית עסקית נקייה, בלי סופרלטיבים וקלישאות.

החזר JSON יחיד בלבד, ללא טקסט נוסף, במבנה המדויק:
{
  "goals": string[],                                  // מטרות הקמפיין — יעדים קונקרטיים
  "metrics": [{ "metric": string, "target": string }],// מדדי הצלחה — מדד + יעד
  "audience": string,                                 // תיאור קהל היעד במשפט-שניים
  "audienceSegments": string[]                        // פילוחים/תתי-קהלים אם עולים מהבריף
}`;

/**
 * The goals-&-objectives drafting layer. Single input — the approved brief. On
 * any failure returns the empty draft so the doc ships with ⟨לא ידוע⟩ instead of
 * invented goals.
 */
@Injectable()
export class ObjectiveDrafterService {
  private readonly log = new Logger(ObjectiveDrafterService.name);

  constructor(private readonly claude: ClaudeJsonService) {}

  async draft(input: { briefMarkdown: string }): Promise<ObjectiveDraft> {
    const user = [
      '=== הבריף המאושר (מקור-אמת) ===',
      input.briefMarkdown.trim(),
      '',
      'נסח מסמך יעדים ומטרות לפי המבנה (3 חלקים). מה שלא בבריף — לא ממציאים.',
    ].join('\n');

    const parsed = await this.claude.json<Partial<ObjectiveDraft>>({
      system: SYSTEM_PROMPT,
      user,
      maxTokens: 4000,
    });
    if (!parsed) {
      this.log.warn('objective drafting produced nothing — empty draft');
      return { ...EMPTY_OBJECTIVE };
    }

    return {
      goals: strArray(parsed.goals),
      metrics: metrics(parsed.metrics),
      audience: str(parsed.audience),
      audienceSegments: strArray(parsed.audienceSegments),
    };
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
function metrics(v: unknown): MetricRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object',
    )
    .map((m) => ({ metric: str(m.metric), target: str(m.target) }))
    .slice(0, 10);
}

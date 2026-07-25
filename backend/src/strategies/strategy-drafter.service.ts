import { Injectable, Logger } from '@nestjs/common';
import { ClaudeJsonService } from '../briefs/claude-json.service';

/** The renderer prints this marker in any slot the model left empty — same
 *  "no invention" contract as the brief. */
export const UNKNOWN = '⟨לא ידוע⟩';

/* -------------------------------------------------------------------------- */
/*  The shape of a drafted strategy — 11 sections, mirroring the sample doc.   */
/* -------------------------------------------------------------------------- */

export interface AudienceRow {
  /** 🥇 / 🥈 / 🥉 or a plain rank label. */
  rank: string;
  audience: string;
  whyOrder: string;
}

export interface MessagePillar {
  pillar: string;
  message: string;
  avoid: string;
}

export interface RoadmapRow {
  period: string;
  structure: string;
  revenue: string;
  realTask: string;
}

export interface MetricRow {
  metric: string;
  targetEarly: string;
  targetLate: string;
}

/** 🟠 Everything the strategy drafting step produces. All of it is a draft. */
export interface StrategyDraft {
  /* 0 · המצב בשורה אחת */
  situationOneLiner: string;
  centralConstraint: string;

  /* 1 · ההימור המרכזי (מיצוב) */
  centralBet: string;
  betRationale: string;
  freeGround: string[];
  betMeaning: string;

  /* 2 · קהל ורצף */
  audiences: AudienceRow[];
  audienceDecision: string;

  /* 3 · המשפך */
  funnelTension: string;
  funnelStages: string[];
  funnelResolution: string;

  /* 4 · מנוע ההוכחה */
  proofIsBlocker: boolean;
  proofMechanism: string;
  proofConditions: string[];
  proofExistingAssets: string[];

  /* 5 · ערוצים */
  channelsPrinciple: string;
  organicChannels: string[];
  paidChannels: string[];
  paidTrigger: string;

  /* 6 · עמודי מסר */
  messagePillars: MessagePillar[];
  removeNow: string[];

  /* 7 · מפת דרכים */
  roadmap: RoadmapRow[];
  roadmapLever: string;
  honestEstimate: string;

  /* 8 · מדדים */
  metrics: MetricRow[];
  metricsNote: string;

  /* 9 · קווים אדומים */
  redLines: string[];

  /* 10 · 90 יום */
  month1: string[];
  month2: string[];
  month3: string[];

  /* 11 · החלטות חוסמות */
  blockingDecisions: string[];

  /* מטא — מוצג בכותרת */
  horizon: string;
}

export const EMPTY_STRATEGY: StrategyDraft = {
  situationOneLiner: UNKNOWN,
  centralConstraint: UNKNOWN,
  centralBet: UNKNOWN,
  betRationale: UNKNOWN,
  freeGround: [],
  betMeaning: UNKNOWN,
  audiences: [],
  audienceDecision: UNKNOWN,
  funnelTension: UNKNOWN,
  funnelStages: [],
  funnelResolution: UNKNOWN,
  proofIsBlocker: false,
  proofMechanism: UNKNOWN,
  proofConditions: [],
  proofExistingAssets: [],
  channelsPrinciple: UNKNOWN,
  organicChannels: [],
  paidChannels: [],
  paidTrigger: UNKNOWN,
  messagePillars: [],
  removeNow: [],
  roadmap: [],
  roadmapLever: UNKNOWN,
  honestEstimate: UNKNOWN,
  metrics: [],
  metricsNote: UNKNOWN,
  redLines: [],
  month1: [],
  month2: [],
  month3: [],
  blockingDecisions: [],
  horizon: UNKNOWN,
};

const SYSTEM_PROMPT = `אתה אסטרטג שיווק בכיר. אתה מקבל בריף עסקי **מאושר** (מסמך מקור-אמת שכבר עבר אישור אנושי) ומייצר ממנו **אסטרטגיית שיווק** — לא סיכום של הבריף, אלא החלטה: על מה מהמרים, במי מתמקדים, באיזה סדר, ואיך סוגרים את הפער בין המצב היום ליעד.

המטרה: מסמך שאפשר לפעול לפיו. חד, מספרי, כן. לא יפה-ומעורפל.

עקרונות הניסוח — חובה:
1. **לזהות מתחים בבריף ולפתור אותם במפורש.** אם הבריף מגלה יעד שאפתני מול קיבולת נמוכה, או רצון ל"לקוחות גדולים" (איכות) מול "מותג של חשיפה רחבה" (כמות) — אל תתעלם. הצג את המתח ופתור אותו (למשל: הפרדה לפי שכבות במשפך). מתח שלא נפתר = אסטרטגיה שבורה.
2. **לבדוק שהמספרים סוגרים.** אם יש יעד הכנסה וקיבולת — חשב: יעד ÷ קיבולת = התמחור/מספר הלקוחות הנדרש. אם זה לא סוגר, אמור זאת במפורש ב-honestEstimate. אל תציג מפת דרכים שהמספרים בה לא מתחברים.
3. **חסם ההוכחה קודם לכול.** אם לעסק אין לקוחות / אין המלצות / אין תיק עבודות — proofIsBlocker=true, וכל האסטרטגיה מתחילה מבניית הוכחה. קמפיין בלי הוכחה חברתית לא ימיר. זו העדיפות מספר 1 בחודשים הראשונים.
4. **הערכת זמנים כנה.** אם היעד אגרסיבי ביחס למצב ההתחלה — אמור זאת ותן אומדן ריאלי (למשל "ריאלי: חודש 7-8, לא 6"). אל תרצה את הלקוח.
5. **בלי המצאות.** מידע שלא מופיע בבריף — "${UNKNOWN}" למחרוזת, מערך ריק לרשימה. **אסור לצטט תוצאות, סטטיסטיקות, כמות לקוחות, המלצות או שמות לקוחות שלא נמסרו.** אם הבריף מציין שאלה כאלה מומצאות באתר — כלול "להסיר" אותן ב-removeNow.
6. **הכול טיוטה.** אתה מנסח טיוטה שתעבור אישור אנושי לפני שנשלחת ללקוח. אל תמציא ביטחון שאין.

סגנון: עברית עסקית נקייה, בלי סופרלטיבים ריקים ("הטוב ביותר", "פורץ דרך") ובלי קלישאות ("פתרונות מותאמים אישית"). משפט חד שאפשר להשתמש בו עדיף על פסקה יפה.

החזר JSON יחיד בלבד, ללא טקסט נוסף, במבנה המדויק:
{
  "situationOneLiner": string,          // המצב היום במשפט אחד — כולל המספרים המרכזיים (לקוחות, יעד, קיבולת, תקציב)
  "centralConstraint": string,          // החסם המרכזי האמיתי במשפט — מה באמת עוצר את הצמיחה (לרוב לא "שיווק" אלא אמון/הוכחה/קיבולת)
  "centralBet": string,                 // ההימור המרכזי — משפט המיצוב. על מה מהמרים, בניגוד לְמה
  "betRationale": string,               // למה דווקא ההימור הזה — על איזה נכס שאי אפשר להעתיק הוא נשען
  "freeGround": string[],               // שטחים פנויים בשוק שההימור תופס (זוויות שאף מתחרה לא לקח)
  "betMeaning": string,                 // מה זה אומר בפועל — ממה מפסיקים להתחרות, איזו קטגוריה מגדירים
  "audiences": [{ "rank": string, "audience": string, "whyOrder": string }],  // קהלים לפי סדר עדיפות; rank = 🥇/🥈/🥉
  "audienceDecision": string,           // ההחלטה: עם מי משיקים כחוד חנית, ומתי מרחיבים
  "funnelTension": string,              // המתח שהמשפך פותר (למשל איכות מול חשיפה)
  "funnelStages": string[],             // שלבי המשפך מלמעלה למטה — כל איבר "שלב → מה קורה בו"
  "funnelResolution": string,           // איך המבנה הזה מספק את שני צדי המתח בלי סתירה
  "proofIsBlocker": boolean,            // האם היעדר הוכחה חברתית הוא צוואר הבקבוק
  "proofMechanism": string,             // המנגנון לבניית הוכחה (למשל מעגל ראשון מוזל תמורת מקרי בוחן)
  "proofConditions": string[],          // התנאים שבלעדיהם המנגנון מתפספס (תיחום זמן, תמורה בחוזה, תיעוד)
  "proofExistingAssets": string[],      // נכסי הוכחה שכבר קיימים ולא ממונפים
  "channelsPrinciple": string,          // עיקרון בחירת הערוצים (למשל אורגני קודם, ממומן רק כשיש הוכחה)
  "organicChannels": string[],          // ערוצים אורגניים לשלב א' — כל איבר "ערוץ — מה עושים בו"
  "paidChannels": string[],             // ערוצים ממומנים לשלב ב' — כל איבר "ערוץ — מה עושים בו"; ריק אם ממומן לא רלוונטי עדיין
  "paidTrigger": string,                // מתי נכנס הממומן (איזה תנאי הוכחה/הכנסה פותח אותו)
  "messagePillars": [{ "pillar": string, "message": string, "avoid": string }],  // עמודי המסר — מה משדרים בכל מקום ומה נמנעים ממנו
  "removeNow": string[],                // מה להסיר מיד מהנוכחות הקיימת (הבטחות/סטטיסטיקות בעייתיות שהבריף חשף)
  "roadmap": [{ "period": string, "structure": string, "revenue": string, "realTask": string }],  // מפת דרכים מהמצב היום ליעד
  "roadmapLever": string,               // המנוף שחוזר לאורך כל הדרך (מקור ההכנסה החוזרת)
  "honestEstimate": string,             // הערכה כנה — האם היעד ריאלי בזמן שהוגדר, ומהו האומדן האמיתי
  "metrics": [{ "metric": string, "targetEarly": string, "targetLate": string }],  // מה מודדים — רק מדדים שמזיזים את המחט, לא מדדי-סרק
  "metricsNote": string,                // המדד הכי חשוב ולמה
  "redLines": string[],                 // קווים אדומים בשיווק — מה אסור להבטיח/להמציא
  "month1": string[],                   // חודש 1 — משימות קונקרטיות
  "month2": string[],                   // חודש 2 — משימות קונקרטיות
  "month3": string[],                   // חודש 3 — משימות קונקרטיות
  "blockingDecisions": string[],        // החלטות פתוחות שחוסמות ביצוע — מה חייבים להכריע כדי לזוז
  "horizon": string                     // אופק האסטרטגיה במילים ספורות (למשל "8 חודשים · יעד ₪17,000/חודש")
}`;

/**
 * The strategy drafting layer.
 *
 * Unlike the brief there is only one layer here — the input is already the
 * resolved, human-approved brief. This is the part a client pays a strategist
 * for; the renderer stamps it "טיוטה — טעון אישור" and, on any failure, we
 * return the empty draft so the strategy ships with ⟨לא ידוע⟩ instead of
 * plausible fiction.
 */
@Injectable()
export class StrategyDrafterService {
  private readonly log = new Logger(StrategyDrafterService.name);

  constructor(private readonly claude: ClaudeJsonService) {}

  async draft(input: { briefMarkdown: string }): Promise<StrategyDraft> {
    const user = [
      '=== הבריף המאושר (מקור-אמת) ===',
      input.briefMarkdown.trim(),
      '',
      'נסח אסטרטגיית שיווק לפי המבנה. זכור: לזהות ולפתור מתחים, לבדוק שהמספרים סוגרים, חסם ההוכחה קודם, הערכת זמנים כנה, ומה שלא בבריף — לא ממציאים.',
    ].join('\n');

    const parsed = await this.claude.json<Partial<StrategyDraft>>({
      system: SYSTEM_PROMPT,
      user,
      maxTokens: 10000,
      // A full 11-section strategy is a large opus generation — the default
      // 120s ceiling clips it. Give it real headroom.
      timeoutMs: 300_000,
    });
    if (!parsed) {
      this.log.warn(
        'strategy drafting produced nothing — shipping empty draft',
      );
      return { ...EMPTY_STRATEGY };
    }

    return {
      situationOneLiner: str(parsed.situationOneLiner),
      centralConstraint: str(parsed.centralConstraint),
      centralBet: str(parsed.centralBet),
      betRationale: str(parsed.betRationale),
      freeGround: strArray(parsed.freeGround),
      betMeaning: str(parsed.betMeaning),
      audiences: audiences(parsed.audiences),
      audienceDecision: str(parsed.audienceDecision),
      funnelTension: str(parsed.funnelTension),
      funnelStages: strArray(parsed.funnelStages),
      funnelResolution: str(parsed.funnelResolution),
      proofIsBlocker: Boolean(parsed.proofIsBlocker),
      proofMechanism: str(parsed.proofMechanism),
      proofConditions: strArray(parsed.proofConditions),
      proofExistingAssets: strArray(parsed.proofExistingAssets),
      channelsPrinciple: str(parsed.channelsPrinciple),
      organicChannels: strArray(parsed.organicChannels),
      paidChannels: strArray(parsed.paidChannels),
      paidTrigger: str(parsed.paidTrigger),
      messagePillars: messagePillars(parsed.messagePillars),
      removeNow: strArray(parsed.removeNow),
      roadmap: roadmap(parsed.roadmap),
      roadmapLever: str(parsed.roadmapLever),
      honestEstimate: str(parsed.honestEstimate),
      metrics: metrics(parsed.metrics),
      metricsNote: str(parsed.metricsNote),
      redLines: strArray(parsed.redLines),
      month1: strArray(parsed.month1),
      month2: strArray(parsed.month2),
      month3: strArray(parsed.month3),
      blockingDecisions: strArray(parsed.blockingDecisions),
      horizon: str(parsed.horizon),
    };
  }
}

/* ---- coercion helpers (same discipline as brief-drafter) ----------------- */

function str(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : UNKNOWN;
}
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x && x !== UNKNOWN);
}
function audiences(v: unknown): AudienceRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (a): a is Record<string, unknown> => Boolean(a) && typeof a === 'object',
    )
    .map((a) => ({
      rank: str(a.rank),
      audience: str(a.audience),
      whyOrder: str(a.whyOrder),
    }))
    .slice(0, 6);
}
function messagePillars(v: unknown): MessagePillar[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object',
    )
    .map((p) => ({
      pillar: str(p.pillar),
      message: str(p.message),
      avoid: str(p.avoid),
    }))
    .slice(0, 8);
}
function roadmap(v: unknown): RoadmapRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object',
    )
    .map((r) => ({
      period: str(r.period),
      structure: str(r.structure),
      revenue: str(r.revenue),
      realTask: str(r.realTask),
    }))
    .slice(0, 8);
}
function metrics(v: unknown): MetricRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object',
    )
    .map((m) => ({
      metric: str(m.metric),
      targetEarly: str(m.targetEarly),
      targetLate: str(m.targetLate),
    }))
    .slice(0, 10);
}

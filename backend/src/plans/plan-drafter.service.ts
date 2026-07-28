import { Injectable, Logger } from '@nestjs/common';
import { ClaudeJsonService } from '../briefs/claude-json.service';

/** Same "no invention" marker as the brief and strategy renderers. */
export const UNKNOWN = '⟨לא ידוע⟩';

/* -------------------------------------------------------------------------- */
/*  The shape of a drafted execution plan — turns strategy into concrete work. */
/* -------------------------------------------------------------------------- */

export interface WorkstreamRow {
  /** The work area, e.g. "בניית הוכחה חברתית". */
  name: string;
  /** What this stream must achieve. */
  goal: string;
  /** Concrete tasks inside it. */
  tasks: string[];
}

export interface TimelineRow {
  /** e.g. "שבוע 1-2" / "חודש 1". */
  period: string;
  /** The focus of that period in a phrase. */
  focus: string;
  /** Concrete tasks for the period. */
  tasks: string[];
}

export interface MilestoneRow {
  period: string;
  milestone: string;
  /** The condition that marks it done. */
  doneWhen: string;
}

export interface PlanMetricRow {
  metric: string;
  target: string;
}

/** 🟠 Everything the plan drafting step produces. All of it is a draft. */
export interface PlanDraft {
  /* Meta / framing */
  focus: string;
  objective: string;
  horizon: string;

  /* The work */
  immediateActions: string[];
  workstreams: WorkstreamRow[];
  timeline: TimelineRow[];
  milestones: MilestoneRow[];

  /* Guardrails */
  dependencies: string[];
  risks: string[];
  metrics: PlanMetricRow[];
}

export const EMPTY_PLAN: PlanDraft = {
  focus: UNKNOWN,
  objective: UNKNOWN,
  horizon: UNKNOWN,
  immediateActions: [],
  workstreams: [],
  timeline: [],
  milestones: [],
  dependencies: [],
  risks: [],
  metrics: [],
};

const SYSTEM_PROMPT = `אתה מנהל ביצוע שיווקי בכיר. אתה מקבל **אסטרטגיית שיווק מאושרת** (מסמך מקור-אמת שכבר עבר אישור אנושי) ומייצר ממנה **תוכנית עבודה/ביצוע** — לא סיכום של האסטרטגיה, אלא תרגום שלה לעשייה: מה עושים, באיזה סדר, מתי, ואיך יודעים שהתקדמנו.

המטרה: מסמך שאפשר לפתוח בבוקר ולעבוד לפיו. קונקרטי, מדיד, מסודר לפי זמן.

עקרונות הניסוח — חובה:
1. **הכול נגזר מהאסטרטגיה.** כל משימה חייבת לשרת החלטה שכבר קיימת באסטרטגיה (ההימור, הקהל, חסם ההוכחה, הערוצים, מפת הדרך). אל תמציא יוזמות שאין להן עוגן באסטרטגיה.
2. **סדר לפי עדיפות אמיתית.** אם האסטרטגיה מסמנת חסם הוכחה כעדיפות 1 — התוכנית מתחילה משם. הצעד הראשון הוא מה שבאמת פותח את השאר.
3. **משימות ולא כותרות.** כל משימה מנוסחת כפעולה שאפשר לסמן כבוצעה ("לכתוב 3 מקרי בוחן מ-3 לקוחות קיימים"), לא כשאיפה ("לחזק נוכחות").
4. **זמנים ריאליים.** אם האסטרטגיה נתנה הערכת זמנים כנה — כבד אותה. אל תדחוס לחודש מה שלוקח שלושה.
5. **בלי המצאות.** מידע שאין באסטרטגיה — "${UNKNOWN}" למחרוזת, מערך ריק לרשימה. אין המצאת מספרים, לקוחות, תוצאות או תאריכים שלא נגזרים מהאסטרטגיה.
6. **הכול טיוטה.** טיוטה שתעבור אישור אנושי לפני שימוש.

סגנון: עברית עסקית נקייה, בלי סופרלטיבים וקלישאות. משפט חד שאפשר לפעול לפיו עדיף על פסקה יפה.

החזר JSON יחיד בלבד, ללא טקסט נוסף, במבנה המדויק:
{
  "focus": string,                 // על מה שלב הביצוע הזה — משפט אחד
  "objective": string,             // היעד המדיד שהתוכנית משרתת (מהאסטרטגיה)
  "horizon": string,               // אופק הזמן, למשל "90 יום"
  "immediateActions": string[],    // מה עושים כבר השבוע — הצעדים הראשונים הקונקרטיים
  "workstreams": [{ "name": string, "goal": string, "tasks": string[] }],  // תחומי העבודה המרכזיים והמשימות בכל אחד
  "timeline": [{ "period": string, "focus": string, "tasks": string[] }],  // פירוק לפי תקופות (שבועות/חודשים) לפי סדר
  "milestones": [{ "period": string, "milestone": string, "doneWhen": string }],  // אבני דרך + התנאי שמסמן שהושלמו
  "dependencies": string[],        // מה חייב להיות מוכרע/מוכן כדי לזוז (החלטות/נכסים חוסמים)
  "risks": string[],               // סיכונים ומכשולים צפויים
  "metrics": [{ "metric": string, "target": string }]  // מה מודדים כדי לדעת שהתוכנית עובדת
}`;

/**
 * The plan drafting layer. The input is the already-approved strategy, so like
 * the strategy stage there is a single layer. On any failure we return the empty
 * draft so the plan ships with ⟨לא ידוע⟩ rather than plausible fiction.
 */
@Injectable()
export class PlanDrafterService {
  private readonly log = new Logger(PlanDrafterService.name);

  constructor(private readonly claude: ClaudeJsonService) {}

  async draft(input: { strategyMarkdown: string }): Promise<PlanDraft> {
    const user = [
      '=== האסטרטגיה המאושרת (מקור-אמת) ===',
      input.strategyMarkdown.trim(),
      '',
      'נסח תוכנית עבודה/ביצוע לפי המבנה. זכור: כל משימה נגזרת מהאסטרטגיה, סדר לפי עדיפות אמיתית, משימות שאפשר לסמן כבוצעו, זמנים ריאליים, ומה שלא באסטרטגיה — לא ממציאים.',
    ].join('\n');

    const parsed = await this.claude.json<Partial<PlanDraft>>({
      system: SYSTEM_PROMPT,
      user,
      maxTokens: 10000,
      // A full execution plan is a large generation — give it real headroom,
      // matching the strategy stage.
      timeoutMs: 300_000,
    });
    if (!parsed) {
      this.log.warn('plan drafting produced nothing — shipping empty draft');
      return { ...EMPTY_PLAN };
    }

    return {
      focus: str(parsed.focus),
      objective: str(parsed.objective),
      horizon: str(parsed.horizon),
      immediateActions: strArray(parsed.immediateActions),
      workstreams: workstreams(parsed.workstreams),
      timeline: timeline(parsed.timeline),
      milestones: milestones(parsed.milestones),
      dependencies: strArray(parsed.dependencies),
      risks: strArray(parsed.risks),
      metrics: metrics(parsed.metrics),
    };
  }
}

/* ---- coercion helpers (same discipline as the strategy drafter) ---------- */

function str(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : UNKNOWN;
}
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x && x !== UNKNOWN);
}
function workstreams(v: unknown): WorkstreamRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (w): w is Record<string, unknown> => Boolean(w) && typeof w === 'object',
    )
    .map((w) => ({
      name: str(w.name),
      goal: str(w.goal),
      tasks: strArray(w.tasks),
    }))
    .slice(0, 8);
}
function timeline(v: unknown): TimelineRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object',
    )
    .map((t) => ({
      period: str(t.period),
      focus: str(t.focus),
      tasks: strArray(t.tasks),
    }))
    .slice(0, 12);
}
function milestones(v: unknown): MilestoneRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object',
    )
    .map((m) => ({
      period: str(m.period),
      milestone: str(m.milestone),
      doneWhen: str(m.doneWhen),
    }))
    .slice(0, 12);
}
function metrics(v: unknown): PlanMetricRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object',
    )
    .map((m) => ({
      metric: str(m.metric),
      target: str(m.target),
    }))
    .slice(0, 10);
}

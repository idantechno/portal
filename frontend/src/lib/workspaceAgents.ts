/**
 * Frontend config for the generic "workspace" agents (those without a bespoke
 * page). Drives the uniform AgentWorkspace: header copy, quick-action chips that
 * pre-send a domain prompt, and a link to the related cockpit screen. The
 * backend keys/tools live in agents/workspace on the server.
 */
export interface QuickAction {
  label: string;
  /** Prompt sent to the agent when the chip is tapped. */
  prompt: string;
}

export interface WorkspaceAgentUiConfig {
  subtitle: string;
  placeholder: string;
  emptyTitle: string;
  emptyText: string;
  quickActions: QuickAction[];
  /** Related cockpit screen (relative to the business), shown in the side rail. */
  related?: { label: string; to: string };
}

export const WORKSPACE_AGENT_UI: Record<string, WorkspaceAgentUiConfig> = {
  marketing: {
    subtitle: "כותב תוכן שיווקי בקול המותג שלך.",
    placeholder: "לדוגמה: כתוב פוסט לפייסבוק על מבצע סוף עונה.",
    emptyTitle: "בוא נכתוב משהו שימכור",
    emptyText:
      "פוסטים, כיתובים, מודעות, מיילים ללקוחות — ספר לי על מה ולאיזה ערוץ, ואכתוב לך. אפשר גם לתזמן פרסום ללו״ז.",
    quickActions: [
      { label: "פוסט לפייסבוק", prompt: "כתוב לי פוסט לפייסבוק שיקדם את העסק." },
      { label: "רעיון לאינסטגרם", prompt: "תן לי רעיון לפוסט לאינסטגרם עם כיתוב." },
      { label: "מייל ללקוחות", prompt: "נסח מייל קצר ללקוחות על מבצע חדש." },
    ],
    related: { label: "לו״ז ומשימות", to: "tasks" },
  },
  analytics: {
    subtitle: "תובנות 'מה לשפר השבוע' מתוך הנתונים שלך.",
    placeholder: "לדוגמה: מה כדאי לי לשפר השבוע?",
    emptyTitle: "בוא נראה איפה לשפר",
    emptyText:
      "אני קורא את הנתונים האמיתיים של העסק — משימות, לידים, הכנסות מול הוצאות — ונותן לך המלצות ממוקדות. אפשר להפוך כל המלצה למשימה בלו״ז.",
    quickActions: [
      { label: "מה לשפר השבוע?", prompt: "מה שלושת הדברים שהכי כדאי לי לשפר השבוע?" },
      { label: "תמונת מצב", prompt: "תן לי תמונת מצב עדכנית של העסק." },
      { label: "מאיפה עוד הכנסה?", prompt: "מאיפה יכולה להגיע לי עוד הכנסה החודש?" },
    ],
    related: { label: "לו״ז ומשימות", to: "tasks" },
  },
  sales: {
    subtitle: "דוחף לידים לסגירה — מעקבים ונרצ׳רינג.",
    placeholder: "לדוגמה: על מי מהלידים כדאי לי להתמקד?",
    emptyTitle: "בוא נסגור עסקאות",
    emptyText:
      "אני רואה את הלידים שלך, מנסח מעקבים אישיים לשליחה, ודואג שלא תשכח לחזור לאף אחד. אפשר לקבוע תזכורת מעקב שתיכנס ללו״ז.",
    quickActions: [
      { label: "מצב הלידים", prompt: "מה מצב הלידים שלי כרגע?" },
      { label: "נסח מעקב", prompt: "נסח הודעת מעקב לליד שביקש הצעה ולא חזר." },
      { label: "על מי להתמקד?", prompt: "על אילו לידים הכי כדאי לי להתמקד עכשיו?" },
    ],
    related: { label: "לידים", to: "leads" },
  },
  crm: {
    subtitle: "שומר את רשומות הלקוחות נקיות ומסודרות.",
    placeholder: "לדוגמה: סכם לי את הלקוח דנה כהן.",
    emptyTitle: "סדר בלקוחות",
    emptyText:
      "אני עוזר לתחזק את רשומות הלקוחות — סיכומים, תיוגים, הערות סטטוס וזיהוי כפילויות. אפשר לשמור הערות ישירות על הליד.",
    quickActions: [
      { label: "סכם לקוח", prompt: "סכם לי אחד הלקוחות והצע לו תיוג." },
      { label: "יש כפילויות?", prompt: "יש לי לידים כפולים או חסרי פרטים?" },
    ],
    related: { label: "לידים", to: "leads" },
  },
  quote: {
    subtitle: "בונה הצעות מחיר מתומחרות ומסודרות.",
    placeholder: "לדוגמה: בנה הצעת מחיר לעיצוב לוגו + מיתוג.",
    emptyTitle: "נבנה הצעת מחיר",
    emptyText:
      "תאר לי מה הלקוח צריך ואבנה הצעה מפורטת ומתומחרת. באישורך אפיק טיוטת חשבונית שתוכל לבדוק ולשלוח ממסך החיוב.",
    quickActions: [
      { label: "בנה הצעה", prompt: "בנה לי הצעת מחיר. אשאל אותך מה כלול." },
      { label: "כמה לגבות?", prompt: "כמה כדאי לי לגבות על העבודה הבאה?" },
    ],
    related: { label: "חיוב", to: "billing" },
  },
  accounting: {
    subtitle: "חשבוניות, מעקב תשלומים ותמונה פיננסית.",
    placeholder: "לדוגמה: סכם לי את החודש.",
    emptyTitle: "הכספים תחת שליטה",
    emptyText:
      "אני מראה לך הכנסות מול הוצאות, מי עוד לא שילם, ומפיק חשבוניות. אפשר גם לסמן חשבונית כשולמה כשמתקבל תשלום.",
    quickActions: [
      { label: "סכם את החודש", prompt: "סכם לי את החודש — הכנסות מול הוצאות." },
      { label: "מי לא שילם?", prompt: "אילו חשבוניות עדיין לא שולמו?" },
      { label: "צור חשבונית", prompt: "צור לי חשבונית. אתן לך את הפרטים." },
    ],
    related: { label: "חיוב", to: "billing" },
  },
  orchestrator: {
    subtitle: "ספר מה אתה צריך — ואנתב אותך לסוכן הנכון.",
    placeholder: "לדוגמה: אני צריך לגבות כסף מלקוח שמאחר.",
    emptyTitle: "מאיפה נתחיל?",
    emptyText:
      "לא בטוח לאיזה סוכן לפנות? תאר לי במילים שלך מה אתה צריך, ואפנה אותך לסוכן המתאים עם כפתור פתיחה.",
    quickActions: [
      { label: "מאיפה להתחיל?", prompt: "אני חדש כאן — עזור לי להבין מאיפה להתחיל." },
    ],
  },
};

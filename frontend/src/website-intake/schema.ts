// Declarative definition of the public website-intake ("brief") form. A client
// fills this so the studio has everything needed to build their site: business
// details, prices, products, location — plus a logo and product images.
//
// Same shape as questionnaire/schema.ts so the wizard renderer is shared in
// spirit. Adds two upload field types (`logo`, `images`) whose File objects are
// held separately from the text answers and sent as multipart parts.

export type FieldType =
  | "text"
  | "textarea"
  | "radio"
  | "checkbox"
  | "logo"
  | "images";

export interface FieldOption {
  value: string;
  label: string;
}

export type Answers = Record<string, string | string[]>;

export interface Field {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  inputMode?: "tel" | "email" | "text";
  options?: FieldOption[];
  /** Adds an "אחר" option with a free-text box (checkbox fields only). */
  allowOther?: boolean;
  /** Max selections for a checkbox field. */
  maxSelect?: number;
}

export interface Step {
  id: string;
  title: string;
  subtitle?: string;
  fields: Field[];
}

export const OTHER = "__other__";

/** Field ids promoted to top-level payload fields (kept out of `sections`). */
const PROMOTED = new Set([
  "businessName",
  "contactName",
  "phone",
  "email",
  "logo",
  "images",
]);

/** The upload field ids — their values are File objects, not strings. */
export const LOGO_FIELD = "logo";
export const IMAGES_FIELD = "images";
export const MAX_IMAGES = 5;

export const STEPS: Step[] = [
  {
    id: "business",
    title: "פרטי העסק",
    subtitle: "נתחיל מהבסיס — מי אתם ואיך יוצרים אתכם קשר.",
    fields: [
      {
        id: "businessName",
        label: "שם העסק",
        type: "text",
        required: true,
        placeholder: "איך קוראים לעסק?",
      },
      {
        id: "contactName",
        label: "שם איש קשר",
        type: "text",
        required: true,
        placeholder: "השם שלך",
      },
      {
        id: "phone",
        label: "טלפון",
        type: "text",
        inputMode: "tel",
        placeholder: "050-0000000",
      },
      {
        id: "email",
        label: "אימייל",
        type: "text",
        inputMode: "email",
        placeholder: "you@example.com",
      },
      {
        id: "area",
        label: "אזור / עיר הפעילות",
        type: "text",
        placeholder: "לדוגמה: תל אביב והמרכז",
      },
      {
        id: "address",
        label: "כתובת פיזית (אם יש)",
        type: "text",
        help: "אם יש בית עסק שאפשר להגיע אליו — נציג אותו עם מפה.",
      },
      {
        id: "hours",
        label: "שעות פעילות",
        type: "textarea",
        placeholder: "לדוגמה: א׳–ה׳ 9:00–18:00, ו׳ 9:00–13:00",
      },
    ],
  },
  {
    id: "about",
    title: "על העסק",
    subtitle: "כדי שנכתוב טקסטים שמדברים בשפה שלכם.",
    fields: [
      {
        id: "oneLiner",
        label: "במשפט אחד — במה העסק עוסק?",
        type: "textarea",
        required: true,
        placeholder: "מה הייתם אומרים למישהו שפוגשים לראשונה",
      },
      {
        id: "about",
        label: "קצת רקע על העסק",
        type: "textarea",
        help: "הסיפור, כמה זמן אתם פעילים, מי עומד מאחורי העסק.",
      },
      {
        id: "differentiator",
        label: "מה מייחד אתכם מהמתחרים?",
        type: "textarea",
      },
      {
        id: "audience",
        label: "מי קהל היעד שלכם?",
        type: "textarea",
        placeholder: "מי הלקוחות שהכי היית רוצה שיגיעו",
      },
    ],
  },
  {
    id: "offering",
    title: "מוצרים, שירותים ומחירים",
    subtitle: "פרטו כמה שיותר — זה הלב של האתר.",
    fields: [
      {
        id: "offerings",
        label: "אילו מוצרים או שירותים אתם מציעים?",
        type: "textarea",
        required: true,
        help: "אפשר לרשום כרשימה. ככל שיותר מפורט — כך האתר יהיה מדויק יותר.",
      },
      {
        id: "prices",
        label: "מחירים",
        type: "textarea",
        help: "מחיר לכל פריט, או 'החל מ-'. אם אתם מעדיפים לא להציג מחירים באתר — כתבו זאת.",
      },
      {
        id: "mainOffering",
        label: "מה הכי חשוב לכם לקדם?",
        type: "text",
        placeholder: "המוצר/שירות שהכי חשוב שיבלוט",
      },
      {
        id: "cta",
        label: "מה תרצו שהמבקר יעשה באתר?",
        type: "checkbox",
        allowOther: true,
        options: [
          { value: "call", label: "יתקשר" },
          { value: "whatsapp", label: "ישלח וואטסאפ" },
          { value: "form", label: "ימלא טופס" },
          { value: "book", label: "יקבע תור" },
          { value: "buy", label: "יבצע הזמנה/רכישה" },
          { value: "visit", label: "יגיע לבית העסק" },
        ],
      },
    ],
  },
  {
    id: "media",
    title: "לוגו ותמונות",
    subtitle: "העלו לוגו ועד 5 תמונות. אלה יופיעו באתר, אז כדאי איכות גבוהה.",
    fields: [
      {
        id: "logo",
        label: "לוגו",
        type: "logo",
        help: "רצוי קובץ ברזולוציה גבוהה או וקטורי (SVG/PNG שקוף).",
      },
      {
        id: "images",
        label: "תמונות (עד 5)",
        type: "images",
        help: "מומלץ תמונות מגוונות בתוכן, וגם בפריסה — חלק לאורך וחלק לרוחב.",
      },
      {
        id: "media_notes",
        label: "הערות על התמונות",
        type: "textarea",
        placeholder: "מה רואים בכל תמונה, או אילו תמונות עוד תשלחו בנפרד",
      },
      {
        id: "socials",
        label: "קישורים לרשתות / אתר קיים",
        type: "textarea",
        placeholder: "אינסטגרם, פייסבוק, אתר נוכחי — כל מה שרלוונטי",
      },
    ],
  },
  {
    id: "style",
    title: "עיצוב והעדפות",
    subtitle: "כדי שהאתר יתאים לאופי של העסק.",
    fields: [
      {
        id: "vibe",
        label: "איזה אופי מתאים לעסק?",
        type: "checkbox",
        maxSelect: 3,
        help: "אפשר לבחור עד 3.",
        options: [
          { value: "luxury", label: "יוקרתי" },
          { value: "clean", label: "נקי ומינימליסטי" },
          { value: "warm", label: "חם ואישי" },
          { value: "bold", label: "נועז וצבעוני" },
          { value: "professional", label: "מקצועי ורציני" },
          { value: "playful", label: "כיפי ושובב" },
          { value: "natural", label: "טבעי ורגוע" },
        ],
      },
      {
        id: "brandColorsOnly",
        label: "צבעי המותג",
        type: "checkbox",
        help: "את צבעי המותג המדויקים אנחנו מקבלים בטופס נפרד. אם חשוב לכם שנשתמש אך ורק בהם באתר — סמנו כאן.",
        options: [
          {
            value: "brand_only",
            label: "השתמשו רק בצבעי המותג של העסק",
          },
        ],
      },
      {
        id: "colors",
        label: "צבעים מועדפים נוספים (אם יש)",
        type: "text",
        help: "רלוונטי רק אם לא סימנתם 'רק צבעי המותג' למעלה.",
        placeholder: "לדוגמה: כחול כהה וזהב",
      },
      {
        id: "likedSites",
        label: "אתרים שאהבתם",
        type: "textarea",
        help: "קישורים לאתרים (של מתחרים או מכל תחום) שמצא חן בעיניכם, ולמה.",
      },
      {
        id: "anythingElse",
        label: "עוד משהו שחשוב שנדע?",
        type: "textarea",
      },
    ],
  },
];

export function isEmptyStr(v: string | string[] | undefined): boolean {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  return v.trim() === "";
}

/** Returns a Hebrew error message for the step, or null if it's valid. */
export function validateStep(step: Step, answers: Answers): string | null {
  for (const field of step.fields) {
    if (field.type === "logo" || field.type === "images") continue;
    if (field.required && isEmptyStr(answers[field.id])) {
      return `יש למלא: ${field.label}`;
    }
  }
  if (step.id === "business") {
    const phone = (answers.phone as string) ?? "";
    const email = (answers.email as string) ?? "";
    if (isEmptyStr(phone) && isEmptyStr(email)) {
      return "יש להשאיר טלפון או אימייל אחד לפחות כדי שנוכל לחזור אליך.";
    }
  }
  return null;
}

function renderValue(field: Field, answers: Answers): string {
  const raw = answers[field.id];
  if (isEmptyStr(raw)) return "";
  if (field.type === "checkbox" && Array.isArray(raw)) {
    const parts = raw.map((val) => {
      if (val === OTHER) {
        const other = (answers[`${field.id}_other`] as string) ?? "";
        return other.trim() ? `אחר: ${other.trim()}` : "אחר";
      }
      return field.options?.find((o) => o.value === val)?.label ?? val;
    });
    return parts.join(", ");
  }
  if (field.type === "radio") {
    const val = raw as string;
    return field.options?.find((o) => o.value === val)?.label ?? val;
  }
  return String(raw).trim();
}

export interface AnswerItem {
  id: string;
  label: string;
  value: string;
}

export interface AnswerSection {
  title: string;
  items: AnswerItem[];
}

/** Builds the human-readable sections sent to the backend (contact + upload
 *  fields are promoted/handled separately and excluded here). */
export function buildSections(answers: Answers): AnswerSection[] {
  const sections: AnswerSection[] = [];
  for (const step of STEPS) {
    const items: AnswerItem[] = [];
    for (const field of step.fields) {
      if (PROMOTED.has(field.id)) continue;
      if (field.type === "logo" || field.type === "images") continue;
      const value = renderValue(field, answers);
      if (value) items.push({ id: field.id, label: field.label, value });
    }
    if (items.length > 0) sections.push({ title: step.title, items });
  }
  return sections;
}

export interface IntakePayload {
  businessName: string;
  contactName: string;
  phone?: string;
  email?: string;
  sections: AnswerSection[];
  hp: string;
}

export function buildPayload(answers: Answers, hp: string): IntakePayload {
  const str = (id: string) => ((answers[id] as string) ?? "").trim();
  const phone = str("phone");
  const email = str("email");
  return {
    businessName: str("businessName"),
    contactName: str("contactName"),
    phone: phone || undefined,
    email: email || undefined,
    sections: buildSections(answers),
    hp,
  };
}

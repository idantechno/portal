// Declarative definition of the public marketing-strategy questionnaire.
// The wizard renders straight from STEPS; branching + validation + the payload
// sent to the backend are all derived here so content edits stay in one place.

export type BusinessType = "service" | "product" | "both";
export type Audience = "b2b" | "b2c" | "both";
export type PreferredChannel = "phone" | "whatsapp" | "email";

export type FieldType = "text" | "textarea" | "radio" | "checkbox";

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
  /** Show this field only when the predicate holds (branching within a step). */
  showIf?: (a: Answers) => boolean;
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
  "businessType",
  "businessName",
  "audience",
  "contactName",
  "phone",
  "email",
  "preferredChannel",
]);

const isProduct = (a: Answers) =>
  a.businessType === "product" || a.businessType === "both";
const isService = (a: Answers) =>
  a.businessType === "service" || a.businessType === "both";

export const STEPS: Step[] = [
  {
    id: "type",
    title: "סוג העסק",
    subtitle: "נתחיל מהבסיס — כדי שנתאים את השאלות בדיוק לעסק שלך.",
    fields: [
      {
        id: "businessType",
        label: "מה סוג העסק שלך?",
        type: "radio",
        required: true,
        options: [
          { value: "service", label: "עסק שנותן שירות" },
          { value: "product", label: "עסק שמוכר מוצרים" },
          { value: "both", label: "גם וגם" },
        ],
      },
      {
        id: "businessName",
        label: "שם העסק",
        type: "text",
        required: true,
        placeholder: "איך קוראים לעסק?",
      },
      {
        id: "q1_focus",
        label: "במה העסק שלך עוסק?",
        type: "textarea",
        required: true,
        placeholder: "כמה מילים על מה שאתה עושה",
      },
      {
        id: "q4_age",
        label: "כמה זמן העסק קיים?",
        type: "radio",
        required: true,
        options: [
          { value: "not_launched", label: "עדיין לא הושק" },
          { value: "under_1", label: "פחות משנה" },
          { value: "1_3", label: "1–3 שנים" },
          { value: "3_5", label: "3–5 שנים" },
          { value: "over_5", label: "מעל 5 שנים" },
        ],
      },
    ],
  },
  {
    id: "audience",
    title: "קהל היעד",
    subtitle: "מי הלקוחות שאתה הכי רוצה להגיע אליהם.",
    fields: [
      {
        id: "audience",
        label: "מי הלקוחות שלך?",
        type: "radio",
        required: true,
        options: [
          { value: "b2b", label: "עסקים (B2B)" },
          { value: "b2c", label: "לקוחות פרטיים (B2C)" },
          { value: "both", label: "גם וגם" },
        ],
      },
      {
        id: "q5_ideal",
        label: "מי הלקוח האידיאלי שלך?",
        type: "textarea",
        required: true,
        help: "תאר את האדם שהכי היית רוצה שיעבוד איתך או יקנה ממך.",
      },
      {
        id: "q6_problem",
        label: "מה הבעיה או הצורך שבגללו הוא פונה אליך?",
        type: "textarea",
        required: true,
      },
      {
        id: "q7_trigger",
        label: "מה בדרך כלל גורם לו להחליט שהגיע הזמן לחפש פתרון?",
        type: "textarea",
      },
    ],
  },
  {
    id: "offering",
    title: "המוצר / השירות",
    subtitle: "מה אתה מציע, ומה הכי חשוב לך לקדם.",
    fields: [
      {
        id: "q2_offerings",
        label: "אילו מוצרים או שירותים אתה מציע?",
        type: "textarea",
        required: true,
      },
      {
        id: "q3_main",
        label: "מהו המוצר או השירות החשוב ביותר עבורך כיום?",
        type: "textarea",
        required: true,
        help: "אם יש כמה, בחר את זה שהכי חשוב לך לקדם.",
      },
      // Product branch
      {
        id: "q20p_drivers",
        label: "מה לדעתך גורם (או יגרום) ללקוחות לבצע רכישה?",
        type: "checkbox",
        required: true,
        allowOther: true,
        showIf: isProduct,
        options: [
          { value: "price", label: "מחיר" },
          { value: "quality", label: "איכות" },
          { value: "design", label: "עיצוב" },
          { value: "brand", label: "מותג" },
          { value: "reviews", label: "המלצות" },
          { value: "availability", label: "זמינות" },
        ],
      },
      {
        id: "q21p_repeat",
        label: "רוב הלקוחות קונים פעם אחת או חוזרים לקנות שוב?",
        type: "radio",
        showIf: isProduct,
        options: [
          { value: "one_time", label: "בעיקר קנייה חד-פעמית" },
          { value: "some", label: "חלק חוזרים" },
          { value: "most", label: "רובם חוזרים" },
          { value: "na", label: "עדיין אין מכירות" },
        ],
      },
      {
        id: "q22p_decide",
        label: "כמה זמן בדרך כלל לוקח ללקוח להחליט שהוא קונה?",
        type: "radio",
        showIf: isProduct,
        options: [
          { value: "instant", label: "באותו רגע" },
          { value: "days", label: "כמה ימים" },
          { value: "weeks", label: "שבועות" },
          { value: "varies", label: "משתנה מאוד" },
          { value: "na", label: "עדיין לא רלוונטי (בהקמה)" },
        ],
      },
      // Service branch
      {
        id: "q20s_know",
        label: "האם רוב הלקוחות כבר יודעים מה הם צריכים כשהם פונים אליך?",
        type: "radio",
        required: true,
        showIf: isService,
        options: [
          { value: "yes", label: "כן" },
          { value: "some", label: "חלקם" },
          { value: "no", label: "לא, צריך להסביר ולבנות אמון" },
          { value: "na", label: "עדיין אין פניות (בהקמה)" },
        ],
      },
      {
        id: "q21s_cycle",
        label: "כמה זמן עובר מהפנייה הראשונה ועד סגירת העסקה?",
        type: "radio",
        showIf: isService,
        options: [
          { value: "same_day", label: "באותו יום" },
          { value: "week", label: "עד שבוע" },
          { value: "month", label: "עד חודש" },
          { value: "over_month", label: "יותר מחודש" },
          { value: "na", label: "עדיין לא רלוונטי (בהקמה)" },
        ],
      },
      {
        id: "q22s_convince",
        label: "מה משכנע (או לדעתך ישכנע) לקוחות לבחור דווקא בך?",
        type: "textarea",
        showIf: isService,
      },
    ],
  },
  {
    id: "differentiation",
    title: "הבידול שלך",
    subtitle: "מה מייחד אותך — ומה מושך לקוחות למתחרים.",
    fields: [
      {
        id: "q9_why",
        label: "למה שלקוחות יבחרו דווקא בך?",
        type: "textarea",
        required: true,
      },
      {
        id: "q11_oneliner",
        label: "במשפט אחד — מה מייחד את העסק שלך?",
        type: "textarea",
        required: true,
      },
      {
        id: "q10_competitors",
        label: "למה לדעתך לקוחות בוחרים במתחרים שלך?",
        type: "textarea",
      },
      {
        id: "q8_hesitation",
        label: "מה עלול לגרום ללקוחות להסס לפני שהם קונים ממך?",
        type: "textarea",
      },
    ],
  },
  {
    id: "marketing_now",
    title: "השיווק שלך כיום",
    subtitle: "איפה אתה נמצא היום — מאיפה מגיעים לקוחות ומה כבר קיים.",
    fields: [
      {
        id: "q12_sources",
        label: "מאיפה מגיעים רוב הלקוחות שלך כיום?",
        type: "checkbox",
        required: true,
        allowOther: true,
        options: [
          { value: "referrals", label: "המלצות" },
          { value: "instagram", label: "אינסטגרם" },
          { value: "facebook", label: "פייסבוק" },
          { value: "google", label: "גוגל" },
          { value: "tiktok", label: "טיקטוק" },
          { value: "website", label: "אתר אינטרנט" },
          { value: "returning", label: "לקוחות חוזרים" },
          { value: "partnerships", label: "שיתופי פעולה" },
          { value: "none", label: "עדיין אין לקוחות (בהקמה)" },
        ],
      },
      {
        id: "q30_assets",
        label: "אילו נכסים דיגיטליים כבר קיימים לעסק?",
        type: "checkbox",
        required: true,
        allowOther: true,
        options: [
          { value: "website", label: "אתר" },
          { value: "landing", label: "דף נחיתה" },
          { value: "gbp", label: "Google Business Profile" },
          { value: "facebook", label: "פייסבוק" },
          { value: "instagram", label: "אינסטגרם" },
          { value: "tiktok", label: "טיקטוק" },
          { value: "linkedin", label: "לינקדאין" },
          { value: "youtube", label: "יוטיוב" },
          { value: "wa_business", label: "וואטסאפ Business" },
          { value: "mailing", label: "רשימת תפוצה" },
          { value: "crm", label: "מערכת CRM" },
          { value: "none", label: "עדיין אין נכסים דיגיטליים" },
        ],
      },
      {
        id: "q13_tried",
        label: "האם ניסית לשווק את העסק בעבר? מה עבד ומה לא?",
        type: "textarea",
      },
      {
        id: "q14_best_channel",
        label: "אם יש ערוץ אחד שמביא לך היום את התוצאות הטובות ביותר — מה הוא?",
        type: "text",
      },
    ],
  },
  {
    id: "budget",
    title: "תקציב ומשאבים",
    subtitle: "כמה אתה יכול ורוצה להשקיע בשיווק.",
    fields: [
      {
        id: "q23_has_budget",
        label: "האם כיום יש לעסק תקציב קבוע לשיווק?",
        type: "radio",
        required: true,
        options: [
          { value: "yes", label: "כן" },
          { value: "no", label: "לא" },
        ],
      },
      {
        id: "q24_budget_size",
        label: "מה סדר הגודל החודשי?",
        type: "radio",
        showIf: (a) => a.q23_has_budget === "yes",
        options: [
          { value: "u1000", label: "עד ₪1,000" },
          { value: "1000_3000", label: "₪1,000–3,000" },
          { value: "3000_7000", label: "₪3,000–7,000" },
          { value: "over7000", label: "מעל ₪7,000" },
        ],
      },
      {
        id: "q26_paid",
        label: "האם אתה פתוח לשיווק ממומן?",
        type: "radio",
        required: true,
        options: [
          { value: "yes", label: "כן" },
          { value: "maybe", label: "אולי" },
          { value: "no", label: "כרגע לא" },
        ],
      },
      {
        id: "q25_willing",
        label: "אם היית יודע שכל שקל שתשקיע יחזור אליך ברווח — כמה היית מוכן להשקיע בחודש?",
        type: "text",
      },
    ],
  },
  {
    id: "goals",
    title: "המטרות שלך",
    subtitle: "לאן אתה רוצה להגיע — וזה שיכוון את כל האסטרטגיה.",
    fields: [
      {
        id: "q16_success",
        label: "מה מבחינתך ייחשב הצלחה?",
        type: "textarea",
        required: true,
        help: "לדוגמה: יותר לקוחות, לקוחות איכותיים יותר, יותר הכנסות, פחות עומס, יותר חשיפה.",
      },
      {
        id: "q15_sixmonths",
        label: "איפה היית רוצה לראות את העסק בעוד חצי שנה?",
        type: "textarea",
      },
      {
        id: "q33_tradeoff",
        label: "מה חשוב לך יותר?",
        help: "(נניח שההכנסות בשני המקרים יהיו זהות)",
        type: "radio",
        required: true,
        options: [
          { value: "few_big", label: "פחות לקוחות, אבל עסקאות גדולות יותר" },
          { value: "many_small", label: "הרבה לקוחות, גם אם כל עסקה קטנה יותר" },
          { value: "balance", label: "איזון בין השניים" },
        ],
      },
      {
        id: "q34_brand",
        label: "מה חשוב לך יותר בבניית המותג?",
        help: "(נניח שההכנסות בשני המקרים יהיו זהות)",
        type: "radio",
        required: true,
        options: [
          { value: "quality", label: "להיתפס כעסק איכותי ומוביל" },
          { value: "reach", label: "להגיע לכמה שיותר אנשים" },
          { value: "both", label: "לשלב בין השניים" },
        ],
      },
    ],
  },
  {
    id: "positioning",
    title: "המיצוב שלך",
    subtitle: "איך היית רוצה שיתפסו את העסק שלך.",
    fields: [
      {
        id: "q31_describe",
        label: "איך היית רוצה שלקוחות יתארו את העסק שלך?",
        type: "checkbox",
        required: true,
        maxSelect: 3,
        help: "אפשר לבחור עד 3.",
        options: [
          { value: "luxury", label: "יוקרתי" },
          { value: "professional", label: "מקצועי" },
          { value: "quality", label: "איכותי" },
          { value: "reliable", label: "אמין" },
          { value: "innovative", label: "חדשני" },
          { value: "personal", label: "אישי" },
          { value: "creative", label: "יצירתי" },
          { value: "fast", label: "מהיר" },
          { value: "affordable", label: "משתלם" },
          { value: "folksy", label: "עממי" },
        ],
      },
      {
        id: "q32_top",
        label: "מבין אלה שבחרת — מה הכי חשוב לך?",
        type: "text",
      },
      {
        id: "q17_personality",
        label: "אם העסק שלך היה בן אדם — איך היית מתאר את האישיות שלו?",
        type: "textarea",
      },
    ],
  },
  {
    id: "challenges",
    title: "אתגרים ומתחרים",
    subtitle: "מה מעכב אותך היום, ומי סביבך.",
    fields: [
      {
        id: "q28_blocker",
        label: "מה לדעתך היום הדבר שהכי מעכב את צמיחת העסק?",
        type: "checkbox",
        required: true,
        allowOther: true,
        options: [
          { value: "exposure", label: "מעט חשיפה" },
          { value: "leads", label: "מעט פניות" },
          { value: "sales", label: "מעט מכירות" },
          { value: "time", label: "חוסר זמן" },
          { value: "pricing", label: "תמחור" },
          { value: "not_started", label: "עדיין לא התחלתי / בהקמה" },
          { value: "unknown", label: "אני לא יודע" },
        ],
      },
      {
        id: "q27_worry",
        label: "מה הכי מטריד אותך כשאתה חושב על שיווק?",
        type: "checkbox",
        allowOther: true,
        options: [
          { value: "waste", label: "לבזבז כסף" },
          { value: "no_leads", label: "שלא יגיעו לקוחות" },
          { value: "no_time", label: "שאין לי זמן" },
          { value: "where_start", label: "אני לא יודע מאיפה להתחיל" },
          { value: "burned", label: "כבר ניסיתי בעבר ולא ראיתי תוצאות" },
        ],
      },
      {
        id: "q35_competitor",
        label: "מי לדעתך המתחרה הטוב ביותר שלך?",
        type: "text",
      },
      {
        id: "q36_inspiration",
        label: "יש עסק (מהארץ או מחו״ל) שאתה אוהב את הדרך שבה הוא משווק את עצמו? איזה?",
        type: "textarea",
      },
    ],
  },
  {
    id: "contact",
    title: "פרטי קשר",
    subtitle: "לאן נשלח לך את האסטרטגיה ואיך נחזור אליך.",
    fields: [
      {
        id: "contactName",
        label: "שם מלא",
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
        id: "preferredChannel",
        label: "איך הכי נוח שנחזור אליך?",
        type: "radio",
        options: [
          { value: "phone", label: "טלפון" },
          { value: "whatsapp", label: "וואטסאפ" },
          { value: "email", label: "אימייל" },
        ],
      },
      {
        id: "q37_anything",
        label: "משהו נוסף שחשוב לך שנדע לפני שנבנה עבורך אסטרטגיה?",
        type: "textarea",
      },
    ],
  },
];

export function isFieldVisible(field: Field, answers: Answers): boolean {
  return !field.showIf || field.showIf(answers);
}

function isEmpty(v: string | string[] | undefined): boolean {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  return v.trim() === "";
}

/** Returns a Hebrew error message for the step, or null if it's valid. */
export function validateStep(step: Step, answers: Answers): string | null {
  for (const field of step.fields) {
    if (!isFieldVisible(field, answers)) continue;
    if (field.required && isEmpty(answers[field.id])) {
      return `יש למלא: ${field.label}`;
    }
  }
  if (step.id === "contact") {
    const phone = (answers.phone as string) ?? "";
    const email = (answers.email as string) ?? "";
    if (isEmpty(phone) && isEmpty(email)) {
      return "יש להשאיר טלפון או אימייל אחד לפחות כדי שנוכל לחזור אליך.";
    }
  }
  return null;
}

function renderValue(field: Field, answers: Answers): string {
  const raw = answers[field.id];
  if (isEmpty(raw)) return "";
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
  /** Field id — lets the backend map an answer back to its question without
   *  matching on the label text (see backend `briefs/questionnaire-schema.ts`). */
  id: string;
  label: string;
  value: string;
}

export interface AnswerSection {
  title: string;
  items: AnswerItem[];
}

/** Builds the human-readable sections sent to the backend (contact + the
 *  branching selectors are promoted to top-level fields and excluded here). */
export function buildSections(answers: Answers): AnswerSection[] {
  const sections: AnswerSection[] = [];
  for (const step of STEPS) {
    const items: AnswerItem[] = [];
    for (const field of step.fields) {
      if (PROMOTED.has(field.id)) continue;
      if (!isFieldVisible(field, answers)) continue;
      const value = renderValue(field, answers);
      if (value) items.push({ id: field.id, label: field.label, value });
    }
    if (items.length > 0) sections.push({ title: step.title, items });
  }
  return sections;
}

export interface QuestionnairePayload {
  businessName: string;
  businessType: BusinessType;
  audience: Audience;
  contactName: string;
  phone?: string;
  email?: string;
  preferredChannel?: PreferredChannel;
  sections: AnswerSection[];
  hp: string;
  /** Campaign tag from the URL (?src= / ?utm_source=) — which channel sent them. */
  src?: string;
}

/** Reads the campaign tag off the landing-page URL, if present. */
export function readCampaignTag(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const p = new URLSearchParams(window.location.search);
  const v = (p.get("src") ?? p.get("utm_source") ?? "").trim();
  return v ? v.slice(0, 60) : undefined;
}

export function buildPayload(answers: Answers, hp: string): QuestionnairePayload {
  const str = (id: string) => ((answers[id] as string) ?? "").trim();
  const phone = str("phone");
  const email = str("email");
  const channel = str("preferredChannel");
  return {
    businessName: str("businessName"),
    businessType: answers.businessType as BusinessType,
    audience: answers.audience as Audience,
    contactName: str("contactName"),
    phone: phone || undefined,
    email: email || undefined,
    preferredChannel: (channel || undefined) as PreferredChannel | undefined,
    sections: buildSections(answers),
    hp,
    src: readCampaignTag(),
  };
}

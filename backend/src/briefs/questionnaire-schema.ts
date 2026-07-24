/**
 * Backend mirror of the public questionnaire schema
 * (`frontend/src/questionnaire/schema.ts`).
 *
 * Why a mirror and not an import: the questionnaire is a frontend wizard, and
 * what reaches the backend is a *rendered* summary — `sections[].items[]` of
 * `{ label, value }` where value is already the Hebrew option label. To build a
 * brief we need the semantics back (which option was picked, which step it came
 * from), so we keep a small, flat description of the fields here.
 *
 * Newer submissions also carry `items[].id`; older rows don't. Both paths are
 * supported: id first, label as the fallback key.
 *
 * KEEP IN SYNC with the frontend schema. If a question is added there, add it
 * here too — an unmapped answer simply never reaches the brief.
 */

export type QFieldType = 'text' | 'textarea' | 'radio' | 'checkbox';

export interface QField {
  id: string;
  /** The exact label rendered by the wizard — the fallback matching key. */
  label: string;
  /** 1-based wizard step, surfaced in the brief as the 🔵[n] source tag. */
  step: number;
  type: QFieldType;
  /** Only asked for this kind of business (the wizard branches on it). */
  branch?: 'product' | 'service';
  /** value → Hebrew label, for radio/checkbox fields. */
  options?: Record<string, string>;
}

export const Q_FIELDS: QField[] = [
  /* ---- 1 · סוג העסק ----------------------------------------------------- */
  {
    id: 'businessType',
    label: 'מה סוג העסק שלך?',
    step: 1,
    type: 'radio',
    options: {
      service: 'עסק שנותן שירות',
      product: 'עסק שמוכר מוצרים',
      both: 'גם וגם',
    },
  },
  { id: 'businessName', label: 'שם העסק', step: 1, type: 'text' },
  { id: 'q1_focus', label: 'במה העסק שלך עוסק?', step: 1, type: 'textarea' },
  {
    id: 'q4_age',
    label: 'כמה זמן העסק קיים?',
    step: 1,
    type: 'radio',
    options: {
      not_launched: 'עדיין לא הושק',
      under_1: 'פחות משנה',
      '1_3': '1–3 שנים',
      '3_5': '3–5 שנים',
      over_5: 'מעל 5 שנים',
    },
  },

  /* ---- 2 · קהל היעד ----------------------------------------------------- */
  {
    id: 'audience',
    label: 'מי הלקוחות שלך?',
    step: 2,
    type: 'radio',
    options: {
      b2b: 'עסקים (B2B)',
      b2c: 'לקוחות פרטיים (B2C)',
      both: 'גם וגם',
    },
  },
  {
    id: 'q5_ideal',
    label: 'מי הלקוח האידיאלי שלך?',
    step: 2,
    type: 'textarea',
  },
  {
    id: 'q6_problem',
    label: 'מה הבעיה או הצורך שבגללו הוא פונה אליך?',
    step: 2,
    type: 'textarea',
  },
  {
    id: 'q7_trigger',
    label: 'מה בדרך כלל גורם לו להחליט שהגיע הזמן לחפש פתרון?',
    step: 2,
    type: 'textarea',
  },

  /* ---- 3 · המוצר / השירות ----------------------------------------------- */
  {
    id: 'q2_offerings',
    label: 'אילו מוצרים או שירותים אתה מציע?',
    step: 3,
    type: 'textarea',
  },
  {
    id: 'q3_main',
    label: 'מהו המוצר או השירות החשוב ביותר עבורך כיום?',
    step: 3,
    type: 'textarea',
  },
  {
    id: 'q20p_drivers',
    branch: 'product',
    label: 'מה לדעתך גורם (או יגרום) ללקוחות לבצע רכישה?',
    step: 3,
    type: 'checkbox',
    options: {
      price: 'מחיר',
      quality: 'איכות',
      design: 'עיצוב',
      brand: 'מותג',
      reviews: 'המלצות',
      availability: 'זמינות',
    },
  },
  {
    id: 'q21p_repeat',
    branch: 'product',
    label: 'רוב הלקוחות קונים פעם אחת או חוזרים לקנות שוב?',
    step: 3,
    type: 'radio',
    options: {
      one_time: 'בעיקר קנייה חד-פעמית',
      some: 'חלק חוזרים',
      most: 'רובם חוזרים',
      na: 'עדיין אין מכירות',
    },
  },
  {
    id: 'q22p_decide',
    branch: 'product',
    label: 'כמה זמן בדרך כלל לוקח ללקוח להחליט שהוא קונה?',
    step: 3,
    type: 'radio',
    options: {
      instant: 'באותו רגע',
      days: 'כמה ימים',
      weeks: 'שבועות',
      varies: 'משתנה מאוד',
      na: 'עדיין לא רלוונטי (בהקמה)',
    },
  },
  {
    id: 'q20s_know',
    branch: 'service',
    label: 'האם רוב הלקוחות כבר יודעים מה הם צריכים כשהם פונים אליך?',
    step: 3,
    type: 'radio',
    options: {
      yes: 'כן',
      some: 'חלקם',
      no: 'לא, צריך להסביר ולבנות אמון',
      na: 'עדיין אין פניות (בהקמה)',
    },
  },
  {
    id: 'q21s_cycle',
    branch: 'service',
    label: 'כמה זמן עובר מהפנייה הראשונה ועד סגירת העסקה?',
    step: 3,
    type: 'radio',
    options: {
      same_day: 'באותו יום',
      week: 'עד שבוע',
      month: 'עד חודש',
      over_month: 'יותר מחודש',
      na: 'עדיין לא רלוונטי (בהקמה)',
    },
  },
  {
    id: 'q22s_convince',
    branch: 'service',
    label: 'מה משכנע (או לדעתך ישכנע) לקוחות לבחור דווקא בך?',
    step: 3,
    type: 'textarea',
  },

  /* ---- 4 · הבידול ------------------------------------------------------- */
  {
    id: 'q9_why',
    label: 'למה שלקוחות יבחרו דווקא בך?',
    step: 4,
    type: 'textarea',
  },
  {
    id: 'q11_oneliner',
    label: 'במשפט אחד — מה מייחד את העסק שלך?',
    step: 4,
    type: 'textarea',
  },
  {
    id: 'q10_competitors',
    label: 'למה לדעתך לקוחות בוחרים במתחרים שלך?',
    step: 4,
    type: 'textarea',
  },
  {
    id: 'q8_hesitation',
    label: 'מה עלול לגרום ללקוחות להסס לפני שהם קונים ממך?',
    step: 4,
    type: 'textarea',
  },

  /* ---- 5 · השיווק כיום -------------------------------------------------- */
  {
    id: 'q12_sources',
    label: 'מאיפה מגיעים רוב הלקוחות שלך כיום?',
    step: 5,
    type: 'checkbox',
    options: {
      referrals: 'המלצות',
      instagram: 'אינסטגרם',
      facebook: 'פייסבוק',
      google: 'גוגל',
      tiktok: 'טיקטוק',
      website: 'אתר אינטרנט',
      returning: 'לקוחות חוזרים',
      partnerships: 'שיתופי פעולה',
      none: 'עדיין אין לקוחות (בהקמה)',
    },
  },
  {
    id: 'q30_assets',
    label: 'אילו נכסים דיגיטליים כבר קיימים לעסק?',
    step: 5,
    type: 'checkbox',
    options: {
      website: 'אתר',
      landing: 'דף נחיתה',
      gbp: 'Google Business Profile',
      facebook: 'פייסבוק',
      instagram: 'אינסטגרם',
      tiktok: 'טיקטוק',
      linkedin: 'לינקדאין',
      youtube: 'יוטיוב',
      wa_business: 'וואטסאפ Business',
      mailing: 'רשימת תפוצה',
      crm: 'מערכת CRM',
      none: 'עדיין אין נכסים דיגיטליים',
    },
  },
  {
    id: 'q13_tried',
    label: 'האם ניסית לשווק את העסק בעבר? מה עבד ומה לא?',
    step: 5,
    type: 'textarea',
  },
  {
    id: 'q14_best_channel',
    label: 'אם יש ערוץ אחד שמביא לך היום את התוצאות הטובות ביותר — מה הוא?',
    step: 5,
    type: 'text',
  },

  /* ---- 6 · תקציב -------------------------------------------------------- */
  {
    id: 'q23_has_budget',
    label: 'האם כיום יש לעסק תקציב קבוע לשיווק?',
    step: 6,
    type: 'radio',
    options: { yes: 'כן', no: 'לא' },
  },
  {
    id: 'q24_budget_size',
    label: 'מה סדר הגודל החודשי?',
    step: 6,
    type: 'radio',
    options: {
      u1000: 'עד ₪1,000',
      '1000_3000': '₪1,000–3,000',
      '3000_7000': '₪3,000–7,000',
      over7000: 'מעל ₪7,000',
    },
  },
  {
    id: 'q26_paid',
    label: 'האם אתה פתוח לשיווק ממומן?',
    step: 6,
    type: 'radio',
    options: { yes: 'כן', maybe: 'אולי', no: 'כרגע לא' },
  },
  {
    id: 'q25_willing',
    label:
      'אם היית יודע שכל שקל שתשקיע יחזור אליך ברווח — כמה היית מוכן להשקיע בחודש?',
    step: 6,
    type: 'text',
  },

  /* ---- 7 · המטרות ------------------------------------------------------- */
  {
    id: 'q16_success',
    label: 'מה מבחינתך ייחשב הצלחה?',
    step: 7,
    type: 'textarea',
  },
  {
    id: 'q15_sixmonths',
    label: 'איפה היית רוצה לראות את העסק בעוד חצי שנה?',
    step: 7,
    type: 'textarea',
  },
  {
    id: 'q33_tradeoff',
    label: 'מה חשוב לך יותר?',
    step: 7,
    type: 'radio',
    options: {
      few_big: 'פחות לקוחות, אבל עסקאות גדולות יותר',
      many_small: 'הרבה לקוחות, גם אם כל עסקה קטנה יותר',
      balance: 'איזון בין השניים',
    },
  },
  {
    id: 'q34_brand',
    label: 'מה חשוב לך יותר בבניית המותג?',
    step: 7,
    type: 'radio',
    options: {
      quality: 'להיתפס כעסק איכותי ומוביל',
      reach: 'להגיע לכמה שיותר אנשים',
      both: 'לשלב בין השניים',
    },
  },

  /* ---- 8 · המיצוב ------------------------------------------------------- */
  {
    id: 'q31_describe',
    label: 'איך היית רוצה שלקוחות יתארו את העסק שלך?',
    step: 8,
    type: 'checkbox',
    options: {
      luxury: 'יוקרתי',
      professional: 'מקצועי',
      quality: 'איכותי',
      reliable: 'אמין',
      innovative: 'חדשני',
      personal: 'אישי',
      creative: 'יצירתי',
      fast: 'מהיר',
      affordable: 'משתלם',
      folksy: 'עממי',
    },
  },
  {
    id: 'q32_top',
    label: 'מבין אלה שבחרת — מה הכי חשוב לך?',
    step: 8,
    type: 'text',
  },
  {
    id: 'q17_personality',
    label: 'אם העסק שלך היה בן אדם — איך היית מתאר את האישיות שלו?',
    step: 8,
    type: 'textarea',
  },

  /* ---- 9 · אתגרים ומתחרים ----------------------------------------------- */
  {
    id: 'q28_blocker',
    label: 'מה לדעתך היום הדבר שהכי מעכב את צמיחת העסק?',
    step: 9,
    type: 'checkbox',
    options: {
      exposure: 'מעט חשיפה',
      leads: 'מעט פניות',
      sales: 'מעט מכירות',
      time: 'חוסר זמן',
      pricing: 'תמחור',
      not_started: 'עדיין לא התחלתי / בהקמה',
      unknown: 'אני לא יודע',
    },
  },
  {
    id: 'q27_worry',
    label: 'מה הכי מטריד אותך כשאתה חושב על שיווק?',
    step: 9,
    type: 'checkbox',
    options: {
      waste: 'לבזבז כסף',
      no_leads: 'שלא יגיעו לקוחות',
      no_time: 'שאין לי זמן',
      where_start: 'אני לא יודע מאיפה להתחיל',
      burned: 'כבר ניסיתי בעבר ולא ראיתי תוצאות',
    },
  },
  {
    id: 'q35_competitor',
    label: 'מי לדעתך המתחרה הטוב ביותר שלך?',
    step: 9,
    type: 'text',
  },
  {
    id: 'q36_inspiration',
    label:
      'יש עסק (מהארץ או מחו״ל) שאתה אוהב את הדרך שבה הוא משווק את עצמו? איזה?',
    step: 9,
    type: 'textarea',
  },

  /* ---- 10 · פרטי קשר ---------------------------------------------------- */
  { id: 'contactName', label: 'שם מלא', step: 10, type: 'text' },
  { id: 'phone', label: 'טלפון', step: 10, type: 'text' },
  { id: 'email', label: 'אימייל', step: 10, type: 'text' },
  {
    id: 'preferredChannel',
    label: 'איך הכי נוח שנחזור אליך?',
    step: 10,
    type: 'radio',
    options: { phone: 'טלפון', whatsapp: 'וואטסאפ', email: 'אימייל' },
  },
  {
    id: 'q37_anything',
    label: 'משהו נוסף שחשוב לך שנדע לפני שנבנה עבורך אסטרטגיה?',
    step: 10,
    type: 'textarea',
  },
];

export const Q_FIELD_BY_ID: Record<string, QField> = Object.fromEntries(
  Q_FIELDS.map((f) => [f.id, f]),
);

/** Normalised label → field, for submissions that predate `items[].id`. */
export const Q_FIELD_BY_LABEL: Record<string, QField> = Object.fromEntries(
  Q_FIELDS.map((f) => [normalizeLabel(f.label), f]),
);

export function normalizeLabel(label: string): string {
  return label
    .replace(/\s+/g, ' ')
    .replace(/["'׳״]/g, '')
    .trim();
}

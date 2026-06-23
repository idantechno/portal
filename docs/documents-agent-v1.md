# Documents Agent — V1 PRD

מסמך עוגן לפיתוח הסוכן השני של Portal Studio: **סוכן מסמכים**.

המסמך הוא תוצר שיחת הסקופינג בין idant ל־Claude (2026-06-23). הוא נכתב כדי להיות נקודת ייחוס יחידה לכל החלטה ב־V1 — לא תיעוד מקיף של המוצר.

---

## 1. מטרה

לתת לבעל עסק **"עובד דיגיטלי"** — סוכן AI נגיש (web chat; בעתיד גם PWA / קישור שמור / אייקון על שולחן עבודה) שמכיר את העסק שלו ויודע להפיק מסמכים עסקיים בשיחה חופשית בעברית.

הסוכן עובד בשני **מצבי משלוח** (`delivery_mode`):

- **`client_sign`** — מסמך שדורש חתימת לקוח (חוזה, הזמנת עבודה). הסוכן יוצר URL ייחודי, הלקוח פותח/ממלא/חותם, הפרטים חוזרים לבעל העסק לדשבורד.
- **`owner_send`** — מסמך שבעל העסק שולח לבד (הצעת מחיר). הסוכן מייצר PDF גמור, בעל העסק מוריד ומעביר ללקוח איך שירצה.

הסוכן עצמו **אינו רץ בוואטסאפ ואינו תלוי ב־WhatsApp Cloud API**. וואטסאפ מופיע אך ורק כפיצ׳ר share אופציונלי בסוף flow ה־`client_sign` — `wa.me` / `navigator.share` מהדפדפן של החותם — כתוספת נוחות מעל הדשבורד שהוא ה־source of truth של הנתונים החתומים.

### Out of scope ב־V1
- חשבונית מס / חשבונית מס-קבלה (רגולציה, מספר הקצאה).
- אינטגרציה עם חשבשבת/Greenvoice/iCount.
- שליחת מייל מהפלטפורמה.
- חתימה משפטית מאומתת (DocuSign וכו').
- עורך תבניות לבעל העסק.
- מעקב צפיות/פתיחות.
- גביית תשלום.
- ריבוי חותמים על אותו מסמך.

---

## 2. ה־flows

### בעל עסק
1. נכנס לאפליקציית הסוכן (V1: route בתוך Portal Studio. עתיד: PWA installable / קישור שמור).
2. רואה את התבניות הזמינות. ב־V1: **הזמנת עבודה** (`client_sign`) בלבד.
3. פותח צ׳אט עם הסוכן ומתאר את העסקה בשפה חופשית.
4. הסוכן מחלץ את הוואריאבלים, שואל על מה שחסר (אחד בכל פעם, לא טופס).
5. הסוכן מפעיל `prepare_document`. התוצאה תלויה במצב התבנית:
   - **client_sign** → מחזיר URL לחתימה. בעל העסק מעתיק ושולח ללקוח איך שירצה (וואטסאפ ידני, מייל, SMS).
   - **owner_send** → מחזיר קישור הורדת PDF גמור. בעל העסק מוריד ושולח.
6. בעל העסק רואה ברשימת המסמכים שלו את הסטטוס: טיוטה / נשלח / חתום / בוטל.

### חותם (לקוח של בעל העסק) — חל רק על `client_sign`
ב־`owner_send` הלקוח לא רואה את המערכת בכלל; מקבל PDF במייל/וואטסאפ ידני מבעל העסק.

1. מקבל את ה־URL.
2. פותח (responsive, mobile-first, RTL).
3. רואה את הזמנת העבודה ממותגת לעסק (לוגו, צבע) עם הפרטים שמולאו.
4. ממלא את שדות החותם (שם מלא, ת.ז., תאריך חתימה).
5. חותם דיגיטלית (`react-signature-canvas` או דומה).
6. לוחץ "אישור וחתימה".
7. השרת מייצר PDF חתום סופי. **הדשבורד של בעל העסק מתעדכן אוטומטית** (סטטוס, פרטי חותם, PDF זמין להורדה) — זאת ה־source of truth.
8. מסך הצלחה לחותם, עם כפתור **שיתוף** (תוספת נוחות, לא תנאי הכרחי):
   - מובייל: `navigator.share` עם הקובץ מצורף → הלקוח בוחר וואטסאפ/מייל/SMS מתפריט ה־OS.
   - דסקטופ: `wa.me` deep link לוואטסאפ של בעל העסק עם טקסט וקישור ציבורי ל־PDF, וגם כפתור הורדה לקובץ.

> דפוס זה הוכח כעובד ב־`C:\Users\idant\milui-tofes` — שם הוא קשיח לעסק יחיד. כאן מכלילים אותו ל־multi-tenant + תבניות + שני מצבי משלוח.

---

## 3. מודל נתונים

מודול חדש: `backend/src/documents/`

```
DocumentTemplate (גלובלי, מנוהל ע"י idant)
  id              uuid
  key             string  -- 'work_order' | 'quote' | 'contract'
  name_he         string
  version         int
  delivery_mode   enum    -- 'client_sign' | 'owner_send'
  variable_schema jsonb   -- JSON Schema של הוואריאבלים הדרושים
  html_template   text    -- Handlebars, מסוגנן ב־Tailwind/CSS inline
  created_at, updated_at

  -- V1 seed: רק work_order (delivery_mode='client_sign').
  -- V1.1 יוסיף: quote ('owner_send'), contract ('client_sign').
  -- בכל מצב 'owner_send', השדות public_token/recipient_fields/signature_svg
  -- ב־DocumentInstance יישארו null.

BusinessTemplateConfig (פר עסק × תבנית)
  id            uuid
  business_id   uuid  → businesses
  template_id   uuid  → document_templates
  boilerplate   jsonb -- override של סעיפי ברירת מחדל (תנאי ביטול, תנאי תשלום)
  brand         jsonb -- { logo_url, primary_color, font }
  is_enabled    bool
  unique(business_id, template_id)

DocumentInstance (פר עסקה)
  id                uuid
  business_id       uuid
  template_id       uuid
  template_snapshot jsonb -- העתק של html_template + boilerplate בזמן יצירה
  variables         jsonb -- ערכי הסוכן (client_name, amount, ...)
  status            enum  -- 'draft' | 'sent' | 'signed' | 'cancelled'
  public_token      string unique -- 32 chars, crypto.randomBytes(24).toString('base64url')
  recipient_fields  jsonb -- מה החותם הזין
  signature_svg     text  -- ה־SVG/dataURL של החתימה
  signed_at         timestamp
  signed_pdf_path   string -- תחת BUSINESSES_DIR/<business_id>/documents/
  created_at, updated_at
```

**עיקרון**: `DocumentInstance.template_snapshot` הוא **immutable**. אם idant יעדכן את `DocumentTemplate` בעתיד, מסמכים קיימים לא ישתנו.

---

## 4. סכמת הוואריאבלים — Work Order

```jsonc
{
  "type": "object",
  "required": [
    "client_name", "client_contact",
    "service_description",
    "total_amount", "currency",
    "requires_deposit",
    "start_date", "delivery_date"
  ],
  "properties": {
    "client_name":         { "type": "string" },
    "client_contact":      { "type": "string", "description": "טלפון או מייל" },
    "service_description": { "type": "string", "description": "תיאור השירות שיינתן" },
    "total_amount":        { "type": "number", "minimum": 0 },
    "currency":            { "type": "string", "default": "ILS" },
    "requires_deposit":    { "type": "boolean" },
    "deposit_amount":      { "type": "number", "minimum": 0 },
    "start_date":          { "type": "string", "format": "date" },
    "delivery_date":       { "type": "string", "format": "date" },
    "notes":               { "type": "string" }
  }
}
```

**שדות החותם** (recipient_fields, נפרדים מהוואריאבלים שהסוכן ממלא):
- `signer_full_name` (string, נדרש)
- `signer_id` (string, רשות — ת.ז.)
- `signed_at` (timestamp, אוטומטי)

---

## 5. ה־Agent

### Tools (in-process MCP, באותו דפוס של [tools.ts](../backend/src/agent-worker/tools.ts))

1. **`list_available_templates()`** → רשימת תבניות פעילות לעסק.
2. **`prepare_document(template_key, variables)`** → מאמת מול הסכמה, יוצר `DocumentInstance`. התשובה תלויה ב־`delivery_mode` של התבנית:
   - `client_sign`: `{ id, public_url, status }` — URL לחתימה ע"י הלקוח.
   - `owner_send`: `{ id, pdf_download_url, status }` — קישור הורדה ישיר ל־PDF.
3. **`list_recent_documents(limit?)`** → לשאלות כמו "מה הסטטוס של ההזמנה של אורל?".

### System prompt (תקציר תכליתי, לא נוסח סופי)
- אתה סוכן מסמכים עבור עסק X.
- התבניות הזמינות לך: [רשימה].
- המשתמש (בעל העסק) יתאר עסקה. תפקידך לחלץ את הוואריאבלים הדרושים, לשאול בעדינות על מה שחסר (אחד בכל פעם, לא טופס), ולקרוא ל־`prepare_document`.
- לעולם אל תמציא ערכים שלא נאמרו.
- ענה תמיד בעברית.

---

## 6. Endpoints

צד **בעל העסק** (`/api/...`, מאומת JWT, scoped לפי businessId):
- `GET  /api/document-templates` — רשימת תבניות פעילות + סטטוס.
- `GET  /api/documents` — רשימת ה־instances של העסק.
- `GET  /api/documents/:id` — פרטים מלאים.
- `POST /api/documents/:id/cancel`
- `GET  /api/documents/:id/pdf` — מוריד PDF חתום.
- `PATCH /api/business-template-config/:templateId` — עדכון boilerplate/brand.

צד **הסוכן** — קורא ישירות לשירותי NestJS, לא דרך HTTP.

צד **חותם ציבורי** (ללא auth, אימות ע״י `public_token`):
- `GET  /sign/:token` — מחזיר render-data של המסמך (HTML/JSON של המסמך עם הברנדינג).
- `POST /sign/:token/submit` — body: `{ recipient_fields, signature_svg }` → יוצר PDF חתום, מחזיר URL להורדה.
- `GET  /sign/:token/pdf` — מוריד את ה־PDF החתום (פעם אחת חתום, זמין לתמיד).

---

## 7. Frontend

### דשבורד בעל העסק (`frontend/src/...`)
- `/agents/documents` — רשימת מסמכים + כפתור "סוכן חדש".
- `/agents/documents/chat` — צ׳אט עם הסוכן (פתוח כברירת מחדל).
- `/agents/documents/:id` — מסך מסמך יחיד: סטטוס, URL להעתקה, הורדת PDF, כפתור ביטול.
- `/agents/documents/settings` — הגדרת brand (לוגו, צבע) + boilerplate per template.

### דף החותם (ציבורי)
- `/sign/:token` — RTL, mobile-first. **הבסיס הקיים: `milui-tofes/app/page.tsx`**.

---

## 8. בחירות טכניות

| תחום | בחירה | הערה |
|---|---|---|
| PDF generation | **Puppeteer** (HTML→PDF) | RTL מלא, פונטים עבריים, פלט זהה למסך. עלות: ~300MB בקונטיינר. |
| Template engine | **Handlebars** | פשוט, בטוח, מוכר. |
| Signature capture | **react-signature-canvas** | SVG; משובץ ב־HTML→PDF. |
| Hebrew font | **Heebo** מ־Google Fonts | טעון בשרת ל־PDF + בלקוח. |
| Public token | `crypto.randomBytes(24).toString('base64url')` | 32 chars, ייחודי באינדקס DB. |
| File storage | `BUSINESSES_DIR/<business_id>/documents/<id>.pdf` | תואם ל־`FilesystemService` הקיים. |
| Logo upload | `BUSINESSES_DIR/<business_id>/brand/logo.<ext>` | אפליקציית multer קיימת ב־[context-files](../backend/src/context-files/). |

---

## 9. רפקטור בקוד הקיים

יחיד מהותי: ניתוק `AgentWorkerService.runAgent()` מהקישור הקשיח ל־`conversation → channel reply`.

**מצב היום** ([agent-worker.service.ts](../backend/src/agent-worker/agent-worker.service.ts)):
- מקבל `conversationId`, טוען היסטוריה, מריץ סוכן, שולח דרך `ChannelRegistry.dispatch`.

**מצב נדרש**:
- חילוץ `AgentRunner.run({ systemPrompt, tools, prompt, cwd, model, allowedBuiltinTools })` שמחזיר `{ finalText }`.
- ה־flow הקיים של וואטסאפ עוטף את `AgentRunner` ושומר בתאם.
- ה־flow החדש של documents-agent עוטף את `AgentRunner` ב־route חדש (`POST /api/agents/documents/chat`) שמחזיר את הטקסט ישר ללקוח (SSE/streaming או תגובה רגילה).

זמן משוער: חצי יום.

---

## 10. שלבי V1

| שלב | תוכן | זמן משוער |
|---|---|---|
| **1** | מודל נתונים + מיגרציה + AgentRunner refactor + seed של תבנית `work_order` + הגדרת brand (UI מינימלי) | שבועיים |
| **2** | סוכן מסמכים בצ׳אט (UI + endpoint) + `prepare_document` tool + יצירת `DocumentInstance` + רינדור Puppeteer HTML→PDF | שבועיים |
| **3** | דף חותם ציבורי (port מ־`milui-tofes`) + signature pad + `POST /sign/:token/submit` + PDF חתום סופי + מסך הצלחה + share ל־wa.me | שבועיים |
| **4** | שימוש בפועל ע"י idant על Portal Studio, תיקוני באגים, ליטוש, deploy ל־Railway | שבוע |

**סה"כ**: ~7 שבועות עבודה ממוקדת.

---

## 11. שאלות פתוחות (לא חוסמות התחלה)

1. **אימות חותם נוסף**: רק `public_token` (קל), או גם 4 ספרות אחרונות של טלפון (יותר בטוח, יותר חיכוך)? **ברירת מחדל V1: רק token**.
2. **תפוגת קישור**: לקישור לא־חתום יש תוקף? **V1: לא, חיים לנצח**.
3. **Puppeteer ב־Railway**: לוודא שהפלאן הנוכחי תומך (RAM/דיסק). אם לא — לבדוק `@sparticuz/chromium` (lightweight) או שירות חיצוני כמו Browserless. **לבדוק בתחילת שלב 2**.
4. **התראה לבעל העסק כשהמסמך נחתם**: ב־V1 מופיע ברשימה + ה־wa.me share של הלקוח מגיע אליו דה־פקטו לוואטסאפ. בעתיד: התראת push/מייל מהפלטפורמה ישירות.
5. **נקודת כניסה לבעל העסק**: V1 = route בתוך Portal Studio. אופציות עתידיות: PWA installable מ־`app.portalstudio.co.il/agent` (אייקון על נייד/דסקטופ), subdomain ייחודי, או wrapper נטיבי. **לא חוסם V1**; המוצר עובד מכל URL.

---

## 12. הגדרת הצלחה ל־V1

idant מצליח להפיק הזמנת עבודה אחת אמיתית עבור לקוח אמיתי של Portal Studio, מקצה לקצה:
- שיחה עם הסוכן.
- שליחת URL ללקוח.
- הלקוח חותם בנייד.
- ה־PDF החתום מגיע לוואטסאפ של idant.

אם זה עובד פעם אחת חלקה — V1 done.

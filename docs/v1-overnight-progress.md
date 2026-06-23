# V1 Overnight Progress — Documents Agent

נכתב 2026-06-24 בלילה. סיכום של מה שנבנה בסשן הלילה אחרי שהסכמנו על ה־PRD ב־[documents-agent-v1.md](documents-agent-v1.md).

---

## TL;DR

**V1 הושלם כמעט במלואו — backend + frontend בנויים, מתקמפלים, ו־lint עובר.** מה שנשאר הוא בדיקה חיה (Docker + הרצה אמיתית של הסוכן מול Claude API), שלא יכולתי לעשות לבד.

| שלב PRD | סטטוס | קבצים מרכזיים |
|---|---|---|
| 1. מודל נתונים + AgentRunner + seed | ✓ מלא | `backend/src/documents/*.entity.ts`, `backend/src/agents/agent-runner.service.ts`, `backend/src/documents/seeds/` |
| 2. סוכן מסמכים + endpoint צ׳אט + PDF | ✓ מלא | `documents-agent.service.ts`, `documents.controller.ts`, `document-pdf.service.ts`, `pdf-renderer.service.ts` |
| 3. דף חתימה ציבורי + share | ✓ מלא | `documents-public.controller.ts`, `frontend/src/pages/SignDocument.tsx` |
| בונוס: chat UI לבעל העסק | ✓ מלא | `frontend/src/pages/business/DocumentsAgent.tsx` |
| 4. בדיקה חיה ולישול | ✗ דורש דוקר + הרצה ידנית |

---

## איך לבדוק מחר בבוקר

```bash
# בטרמינל אחד (אחרי שדוקר מופעל)
make dev

# בטרמינל שני (אופציונלי, אם הפרונט לא רץ מתוך docker)
cd frontend && pnpm dev
```

הזרימה לבדיקה:

1. נכנס ל־`http://localhost:5173`, מתחבר/נרשם, יוצר עסק או נכנס לקיים.
2. בתפריט הצד יש פריט חדש: **"סוכן מסמכים"**.
3. לוחצים, כותבים משהו כמו:
   > "הלקוח שלי דנה כהן רוצה ייעוץ — 4 פגישות של שעה, 800 שקל לפגישה. מתחילים ב־1 בינואר ומסיימים ב־1 בפברואר. בלי מקדמה."
4. הסוכן (Claude) אמור:
   - לזהות שזה work_order.
   - לחלץ את הוואריאבלים.
   - לשאול על מה שחסר.
   - לקרוא ל־`prepare_document`.
   - להחזיר תשובה עם URL.
5. ה־URL מופיע כקלט קופץ ל־clipboard. לוחצים על "העתק" ופותחים בטאב אחר.
6. דף החתימה (`/sign/:token`) מציג את המסמך, ממלאים שם, חותמים עם עכבר/אצבע, שולחים.
7. מסך הצלחה — לחיצה על "שלח בוואטסאפ":
   - **מובייל**: נפתח native share עם ה־PDF מצורף.
   - **דסקטופ**: נפתח wa.me עם טקסט וקישור.
8. אפשר להוריד את ה־PDF החתום.

---

## מה לא בדקתי חי (אבל הקוד מתקמפל)

- **הרצת הסוכן מול Claude API** — דורש דוקר עם שרת ה־backend רץ. ה־API key קיים ב־`.env`. אם הסוכן לא מצליח לקרוא ל־tools — סביר שזה בעיית prompt או type mismatch, לא בעיית קוד.
- **Puppeteer מייצר PDF בפועל** — ✓ נבדק עם smoke test. Chromium מותקן, רינדור Hebrew RTL + Heebo עובד. הקובץ `backend/test-pdf-smoke.pdf` (32KB) נוצר בהצלחה — תפתח אותו בבוקר לראות שעברית מוצגת נכון. הקובץ + הסקריפט `backend/test-pdf-smoke.mjs` נועדו למחיקה אחרי סקירה.
- **מיגרציה אוטומטית של הטבלאות** — `DB_SYNCHRONIZE=true` בדב אמור ליצור את הטבלאות החדשות (`document_templates`, `business_template_configs`, `document_instances`) כשהשרת עולה. ה־seed אמור להריץ אחרי שה־schema נוצר.
- **לוגו URL ב־brand config** — `IsUrl` ב־DTO ידרוש URL מלא; אם תרצה לתמוך ב־upload מקומי של לוגו, צריך multer endpoint נפרד (לא נבנה).

---

## מפת קבצים — מה איפה

### Backend

```
backend/src/
├── agents/                              [חדש]
│   ├── agent-runner.service.ts          ← runner גנרי, יחיד וגנרי
│   └── agents.module.ts
├── agent-worker/
│   └── agent-worker.service.ts          ← רוקרר — קוצר מ־208 ל־110 שורות
├── common/enums/
│   ├── delivery-mode.enum.ts            [חדש]
│   └── document-status.enum.ts          [חדש]
└── documents/                           [מודול חדש מלא]
    ├── document-template.entity.ts
    ├── business-template-config.entity.ts
    ├── document-instance.entity.ts
    ├── documents.types.ts               ← BrandConfig, TemplateSnapshot, RecipientFields
    ├── documents.service.ts             ← CRUD + getBusinessConfig + createInstance
    ├── documents-seeder.service.ts      ← OnModuleInit: upsert תבניות מ־seeds/
    ├── documents-agent.service.ts       ← מריץ סוכן ל־chat
    ├── document-pdf.service.ts          ← submitSigning + getOrRenderPdf
    ├── pdf-renderer.service.ts          ← Puppeteer HTML→PDF
    ├── render-context.ts                ← בילדר context ל־Handlebars
    ├── documents.controller.ts          ← endpoints מאומתים
    ├── documents-public.controller.ts   ← endpoints ציבוריים (sign-by-token)
    ├── documents.module.ts
    ├── agent/
    │   ├── prompt.ts                    ← system + user prompts לעברית
    │   └── tools.ts                     ← list_available_templates, prepare_document
    ├── dto/
    │   ├── documents-chat.dto.ts
    │   ├── upsert-business-config.dto.ts
    │   └── submit-signing.dto.ts
    └── seeds/
        ├── work-order.html.ts           ← תבנית HTML עם Heebo + RTL
        ├── work-order.seed.ts           ← schema + meta
        └── index.ts                     ← DOCUMENT_TEMPLATE_SEEDS
```

קבצים שעודכנו:
- `backend/src/app.module.ts` — נוספו AgentsModule, DocumentsModule.
- `backend/src/agent-worker/agent-worker.module.ts` — תלוי AgentsModule.
- `backend/src/agent-worker/agent-worker.service.ts` — משתמש ב־AgentRunner.

### Frontend

```
frontend/src/
├── api/documents.ts                     [חדש]
├── components/SignaturePad.tsx          [חדש] — canvas יד חופשית
├── pages/
│   ├── SignDocument.tsx                 [חדש] — דף ציבורי /sign/:token
│   └── business/DocumentsAgent.tsx      [חדש] — chat UI מאומת
└── App.tsx                              ← routes חדשים: /sign/:token, .../agents/documents
└── pages/business/BusinessLayout.tsx    ← פריט תפריט חדש "סוכן מסמכים"
```

### מסמכים

- `docs/documents-agent-v1.md` — PRD מאושר.
- `docs/v1-overnight-progress.md` — הקובץ הזה.

---

## Endpoints חדשים (Backend)

### מאומתים (JWT + BusinessScope)

| מתודה | נתיב | תיאור |
|---|---|---|
| GET | `/api/businesses/:businessId/document-templates` | תבניות זמינות לעסק |
| GET | `/api/businesses/:businessId/business-template-configs/:templateId` | config של עסק לתבנית |
| PATCH | `/api/businesses/:businessId/business-template-configs/:templateId` | עדכון brand/boilerplate/isEnabled |
| GET | `/api/businesses/:businessId/documents` | רשימת מסמכים |
| GET | `/api/businesses/:businessId/documents/:id` | פרטי מסמך |
| GET | `/api/businesses/:businessId/documents/:id/pdf` | הורדת PDF (מורד preview אם לא חתום) |
| POST | `/api/businesses/:businessId/documents/:id/cancel` | ביטול |
| POST | `/api/businesses/:businessId/agents/documents/chat` | צ׳אט עם הסוכן |

### ציבוריים (@Public)

| מתודה | נתיב | תיאור |
|---|---|---|
| GET | `/api/sign/:token` | נתוני מסמך לחותם |
| POST | `/api/sign/:token/submit` | קבלת חתימה + ייצור PDF סופי |
| GET | `/api/sign/:token/pdf` | הורדת PDF חתום |

---

## החלטות עיצוב/מוצר שעשיתי לבד

(כולן הפיכות — תגיד אם משהו לא מוצא חן בעיניך)

1. **`is_enabled` בתבנית פר־עסק = ברירת מחדל true** — עסק רואה את כל התבניות הגלובליות כברירת מחדל, גם בלי שיצר config. הסיבה: לא רציתי לסבך התקנת עסקים חדשים.

2. **קישור החתימה לא פג** — ב־V1 חי לנצח. צוין כשאלה פתוחה ב־PRD; בחרתי שלא לטפל.

3. **PDF preview גם לפני חתימה** — אם תיגש ל־`/documents/:id/pdf` של מסמך לא חתום, ייוצר PDF טרי כל פעם (לא נשמר). רק חתום נשמר ל־`BUSINESSES_DIR/{businessId}/documents/{id}.pdf`. הסיבה: בעלים רוצים לראות איך זה ייראה לפני שהלקוח חותם.

4. **`PUBLIC_SIGN_BASE_URL` נדרש לעבודה אמיתית** — הסוכן בונה את ה־URL עם הבסיס הזה. ברירת מחדל: `http://localhost:5173`. **לפרוד צריך להוסיף לסביבת Railway: `PUBLIC_SIGN_BASE_URL=https://app.portalstudio.co.il`**.

5. **שלושה boilerplate keys לשימוש בתבנית** — `terms` (כרגע היחיד שמופיע ב־HTML). הוספת keys נוספים = להוסיף ל־seed HTML + ל־brand UI.

6. **חתימה כ־PNG data URL** — לא SVG אמיתי. הסיבה: signature pad משתמש ב־canvas, PNG הוא הפלט הטבעי. שמור בעמודה `signature_svg` מסיבות היסטוריות בשם.

7. **שיתוף וואטסאפ ללא מספר יעד מקודד** — `wa.me/?text=...` (בלי מספר) פותח את חלון בחירת איש קשר של הלקוח. הוא בוחר את בעל העסק. הסיבה: לא רציתי להעמיס שדה `whatsappPhone` ב־brand config ל־V1; אפשר להוסיף בהמשך אם תרצה הדרכה ספציפית לאיש קשר.

---

## מה נשאר ל־V1 ש"באמת מוכן ללקוחות"

1. **הרצה מקצה לקצה והוכחה שעובד עם Claude אמיתי** (~שעה לבדיקה).
2. **דף הגדרות brand בדשבורד** — אין כרגע UI לעדכון לוגו/צבע. רק ה־endpoint. צריך עמוד `frontend/src/pages/business/DocumentsSettings.tsx` (~3 שעות).
3. **כפילות `/api` ב־axios** — בדקתי קוד; אם תהיה בעיה שכל endpoint רואה `/api/api/...`, זה כי `client.ts` קובע `baseURL: '/api'` והנתיבים שלנו (`/sign/...`, `/businesses/...`) נוספים אחרי. צריך **לא** להתחיל נתיבי axios ב־`/api/`. בדקתי, נראה תקין.
4. **wa.me share — כפתור בצד בעל העסק** — כרגע יש רק בצד החותם. אם בעל עסק רוצה לשלוח קישור ללקוח מהדסקטופ דרך wa.me, אין כפתור ייעודי (יש "העתק קישור"). תוספת קטנה.
5. **טסטים** — אין שום unit test על הקוד החדש. כלום. (מתאים — V1 מהיר, מוסיפים אחרי שמוכיחים מוצר.)
6. **מיגרציה אמיתית במקום synchronize** — לפרוד.
7. **Logo upload endpoint** — multer; כרגע רק URL בקונפיג.

---

## שגיאות שהיו בדרך ושוקעו

לתיעוד עתידי בלבד:

| שגיאה | תיקון |
|---|---|
| TypeORM `findByIds` deprecated | החלפה ב־`findBy({ id: In([...]) })` |
| TypeORM `update()` עם jsonb לא מתקבל | החלפה ל־`save(merged)` |
| Puppeteer 25.x `setContent` לא מקבל `networkidle0` | `'load'` + `await page.evaluate(() => document.fonts.ready)` |
| Zod v4 דורש 2 args ל־`record` | `z.record(z.string(), z.unknown())` |
| `buildSystemPrompt` מחזיר `string[]` (cache boundary) | הרחבת AgentRunInput.systemPrompt ל־`string \| string[]` |
| react-hooks lint: setState ב־useEffect | הפיכת feature detection לפונקציה במקום state |

---

## בדיקות שעברו

- `cd backend && pnpm run build` ✓
- `cd backend && pnpm run lint` ✓
- `cd backend && pnpm run test` ✓ (טסט אחד קיים — app.controller, עבר)
- `cd frontend && pnpm run build` ✓
- `cd frontend && pnpm run lint` ✓

---

## אם משהו נשבר בבוקר

1. **השרת לא עולה** — קרוב לוודאי schema mismatch. נסה `make db-reset` כדי לאפס את ה־DB ושיווצר מחדש.
2. **הסוכן מחזיר שגיאה** — בדוק שה־ANTHROPIC_API_KEY תקף (`backend/.env` ← העתק ל־`.env` שורש לוודאות), ושיש קרדיט ב־Anthropic console.
3. **דף החתימה מציג 404** — סביר שהטוקן ב־URL לא תואם לאינסטנס ב־DB. בדוק `psql` ← `SELECT id, public_token, status FROM document_instances ORDER BY created_at DESC LIMIT 5;`.
4. **PDF לא נטען** — בדוק לוגים של ה־backend לראות אם Puppeteer הצליח לעלות. אם לא, ייתכן צריך לעבור ל־`@sparticuz/chromium` (ראה PRD סעיף 11).
5. **כפתור וואטסאפ לא עובד במובייל** — `navigator.share` דורש HTTPS. בדב מקומי זה לא בעיה רק במובייל. דסקטופ — wa.me fallback אמור לעבוד תמיד.

---

## עבודה ללא commits

לפי חוקי הפרויקט לא יכולתי לעשות commits ללא הוראה שלך. כל מה שעשיתי יושב ב־working tree.

**אזהרה על `git status`**: תראה מאות אזהרות "LF will be replaced by CRLF". **אלה לא שינויים אמיתיים** — `pnpm install` נגע ב־mtime של קבצים והגדרת `core.autocrlf` של Windows מתלוננת. `git diff` מאשר שאין שינויי תוכן בקבצים האלה. השינויים האמיתיים: **9 קבצים מודיפיים בלבד** + הקבצים החדשים.

לקבלת diff נקי:
```bash
git diff --stat | grep -E "^\s.*\|" | grep -v "warning:"
```

חלוקה הגיונית ל־commits (כשתרצה):
1. רפקטור AgentRunner (agents/ + agent-worker/ + app.module).
2. data model: entities + module + seed.
3. agent service + chat endpoint + tools.
4. PDF rendering + Puppeteer.
5. public signing endpoints.
6. frontend: signing page + signature pad.
7. frontend: agent chat UI.
8. docs (PRD update + NOTES).

ובסוף: למחוק `backend/test-pdf-smoke.mjs` ו־`backend/test-pdf-smoke.pdf`.

import { writeFileSync } from 'node:fs';
import { renderQuoteHtml } from '../src/quotes/quote-html';

const business = {
  name: 'Portal Studio',
  branding: {
    primaryColor: '#1e2a4a',
    secondaryColor: '#2f6f7a',
    accentColor: '#ff6b5c',
    slogan: 'סטודיו דיגיטלי — מיתוג · אתרים · AI',
    logoUrl: null,
  },
} as never;

const quote = {
  title: 'אתר תדמית — Lago',
  status: 'draft',
  intro:
    'פיד אינטגרציה חי שמתעדכן אוטומטית\nמערכת ניהול תוכן (CMS) לעדכון עצמאי ללא קוד\nטופס מלאות לקוחות\nחיבור למערכת CRM',
  lineItems: [
    {
      name: 'אפיון ואסטרטגיה',
      description: 'פגישת אפיון, מיפוי עמודים ומסרים מרכזיים.',
      amount: '₪2,500',
    },
    {
      name: 'עיצוב UI/UX',
      description: 'עיצוב ויזואלי לכל עמודי האתר בהתאמה למותג.',
      amount: '₪4,000',
    },
    {
      name: 'פיתוח ובנייה',
      description: 'בניית האתר מותאם מובייל עם מערכת ניהול תוכן.',
      amount: '₪6,000',
    },
    {
      name: 'העלאה לאוויר',
      description: 'חיבור דומיין, בדיקות ופרסום האתר.',
      amount: '₪1,000',
    },
  ],
  total: '₪13,500 + מע״מ',
  notes: 'ההצעה בתוקף ל-30 יום. תשלום ב-2 פעימות: מקדמה ויתרה בהעלאה לאוויר.',
  updatedAt: new Date('2026-07-29'),
} as never;

const out = process.argv[2] ?? 'quote-preview.html';
writeFileSync(out, renderQuoteHtml(quote, business));
console.log(`written: ${out}`);

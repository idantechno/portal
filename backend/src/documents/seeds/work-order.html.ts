export const WORK_ORDER_HTML = `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>הזמנת עבודה — {{business.name}}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap');

    :root {
      --primary: {{brand.primaryColor}};
      --ink: #1a1a1a;
      --muted: #6b6b6b;
      --line: #e5e5e5;
      --bg-tint: #fafafa;
    }

    * { box-sizing: border-box; }

    body {
      font-family: 'Heebo', Arial, sans-serif;
      margin: 0;
      padding: 40px 48px;
      color: var(--ink);
      background: white;
      line-height: 1.6;
      font-size: 14px;
    }

    .doc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 24px;
      border-bottom: 2px solid var(--primary);
      margin-bottom: 32px;
    }
    .logo { max-height: 64px; max-width: 200px; }
    .doc-header-meta { text-align: left; color: var(--muted); font-size: 12px; }
    .doc-header-meta .business-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 4px;
    }

    h1 {
      font-size: 26px;
      font-weight: 700;
      margin: 0 0 24px;
      color: var(--primary);
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px 32px;
      padding: 18px;
      background: var(--bg-tint);
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .meta-grid dt {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .meta-grid dd { margin: 0; font-weight: 500; }

    .section { margin-bottom: 24px; }
    .section h2 {
      font-size: 15px;
      font-weight: 700;
      color: var(--primary);
      padding-bottom: 8px;
      border-bottom: 1px solid var(--line);
      margin: 0 0 12px;
    }
    .body-text { white-space: pre-wrap; }

    .payment {
      background: var(--bg-tint);
      padding: 18px;
      border-radius: 8px;
    }
    .payment .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
    }
    .payment .row.total {
      border-top: 2px solid var(--ink);
      margin-top: 8px;
      padding-top: 10px;
      font-size: 16px;
      font-weight: 700;
    }

    .boilerplate {
      font-size: 12px;
      color: var(--muted);
      white-space: pre-wrap;
    }

    .signature-block {
      margin-top: 56px;
      padding-top: 32px;
      border-top: 1px dashed var(--line);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }
    .signature-block .field {
      border-bottom: 1px solid var(--ink);
      padding-bottom: 4px;
      min-height: 60px;
      position: relative;
    }
    .signature-block .label {
      position: absolute;
      bottom: -22px;
      right: 0;
      font-size: 11px;
      color: var(--muted);
    }
    .signature-block .signature-image {
      max-height: 50px;
      max-width: 200px;
    }

    .doc-footer {
      margin-top: 64px;
      font-size: 11px;
      color: var(--muted);
      text-align: center;
    }
  </style>
</head>
<body>
  <header class="doc-header">
    {{#if brand.logoUrl}}
    <img src="{{brand.logoUrl}}" class="logo" alt="{{business.name}}" />
    {{else}}
    <div></div>
    {{/if}}
    <div class="doc-header-meta">
      <div class="business-name">{{business.name}}</div>
      {{#if business.contact}}<div>{{business.contact}}</div>{{/if}}
    </div>
  </header>

  <h1>הזמנת עבודה</h1>

  <dl class="meta-grid">
    <div>
      <dt>שם הלקוח</dt>
      <dd>{{client_name}}</dd>
    </div>
    <div>
      <dt>פרטי קשר</dt>
      <dd>{{client_contact}}</dd>
    </div>
    <div>
      <dt>תאריך תחילה</dt>
      <dd>{{start_date_formatted}}</dd>
    </div>
    <div>
      <dt>תאריך סיום צפוי</dt>
      <dd>{{delivery_date_formatted}}</dd>
    </div>
  </dl>

  <section class="section">
    <h2>תיאור השירות</h2>
    <div class="body-text">{{service_description}}</div>
  </section>

  <section class="section">
    <h2>תנאי תשלום</h2>
    <div class="payment">
      <div class="row">
        <span>סכום כולל</span>
        <span>{{total_formatted}}</span>
      </div>
      {{#if requires_deposit}}
      <div class="row">
        <span>מקדמה לתשלום בחתימה</span>
        <span>{{deposit_formatted}}</span>
      </div>
      <div class="row total">
        <span>יתרה לתשלום</span>
        <span>{{balance_formatted}}</span>
      </div>
      {{else}}
      <div class="row total">
        <span>לתשלום</span>
        <span>{{total_formatted}}</span>
      </div>
      {{/if}}
    </div>
  </section>

  {{#if notes}}
  <section class="section">
    <h2>הערות נוספות</h2>
    <div class="body-text">{{notes}}</div>
  </section>
  {{/if}}

  {{#if boilerplate.terms}}
  <section class="section">
    <h2>תנאים והערות</h2>
    <div class="boilerplate">{{boilerplate.terms}}</div>
  </section>
  {{/if}}

  <div class="signature-block">
    <div>
      <div class="field">{{signer.fullName}}</div>
      <div class="label">שם החותם</div>
    </div>
    <div>
      <div class="field">
        {{#if signature.svg}}
        <img src="{{signature.svg}}" class="signature-image" alt="חתימה" />
        {{/if}}
      </div>
      <div class="label">חתימה{{#if signed_at_formatted}} · {{signed_at_formatted}}{{/if}}</div>
    </div>
  </div>

  <div class="doc-footer">
    מסמך זה הופק על ידי {{business.name}} ב־{{generated_at_formatted}}
  </div>
</body>
</html>`;

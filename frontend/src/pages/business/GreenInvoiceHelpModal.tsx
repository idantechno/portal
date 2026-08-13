import { Icon } from "../../components/icons";

/**
 * Plain-language walkthrough for a non-technical business owner: how to obtain
 * a Green Invoice (morning) API key + secret to paste into the connect form.
 * Opened from the "?" affordance on the Green Invoice connect card.
 */
export default function GreenInvoiceHelpModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const steps = [
    {
      title: "היכנס לחשבון חשבונית ירוקה",
      body: 'התחבר לחשבון שלך ב"מורנינג / חשבונית ירוקה" מהדפדפן.',
    },
    {
      title: "פתח את אזור המפתחים",
      body: "בתפריט: אזור אישי ← כלים למפתחים ← מפתחות API.",
    },
    {
      title: "צור מפתח חדש",
      body: 'לחץ "הוספה", תן שם למפתח (למשל "Portal Studio"), אשר את התקנון ולחץ "שמירה".',
    },
    {
      title: "העתק את שני הערכים",
      body: "יופיעו מזהה מפתח (API Key ID) ומפתח סודי (API Secret). העתק את שניהם והדבק אותם כאן בטופס.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-e3 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center gap-3">
          <div className="rounded-xl bg-brand-50 text-brand-700 p-2">
            <Icon name="receipt" size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg leading-tight">
              איך משיגים מפתח API?
            </h2>
            <div className="text-xs text-neutral-500">
              חיבור חשבונית ירוקה למערכת
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ms-auto rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
            aria-label="סגור"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-sm font-semibold">
                  {i + 1}
                </div>
                <div className="min-w-0 pt-0.5">
                  <div className="text-sm font-semibold text-navy-900">
                    {s.title}
                  </div>
                  <div className="text-sm text-neutral-600 leading-relaxed">
                    {s.body}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-relaxed">
            <span className="font-semibold">שים לב:</span> המפתח הסודי מוצג פעם
            אחת בלבד ביצירה — העתק ושמור אותו מיד, אי אפשר לראות אותו שוב.
            <br />
            כדי ליצור מפתח API צריך מסלול Best ומעלה בחשבונית ירוקה.
          </div>

          <a
            href="https://www.greeninvoice.co.il/help-center/generating-api-key/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            <Icon name="external" size={16} />
            למדריך הרשמי של חשבונית ירוקה
          </a>
        </div>
      </div>
    </div>
  );
}

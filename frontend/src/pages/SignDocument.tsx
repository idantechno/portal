import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../api/client";
import {
  documentsApi,
  type SignDocumentView,
  type SubmitSigningResult,
} from "../api/documents";
import { SignaturePad } from "../components/SignaturePad";

export default function SignDocument() {
  const { token = "" } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  const view = useQuery({
    queryKey: ["sign", token],
    queryFn: () => documentsApi.getSignView(token),
    enabled: Boolean(token),
    retry: false,
  });

  if (view.isLoading) {
    return (
      <CenteredMessage>
        <Spinner />
        <p className="mt-4 text-wood-700/80">טוען את המסמך...</p>
      </CenteredMessage>
    );
  }
  if (view.isError) {
    return (
      <CenteredMessage>
        <h2 className="font-display text-xl text-wood-900 mb-2">
          המסמך לא זמין
        </h2>
        <p className="text-sm text-wood-700/80">
          ייתכן שהמסמך בוטל, התוקף שלו פג, או שהקישור שגוי.
        </p>
      </CenteredMessage>
    );
  }
  if (!view.data) return null;

  return (
    <SignDocumentInner
      token={token}
      view={view.data}
      onSigned={() => {
        void queryClient.invalidateQueries({ queryKey: ["sign", token] });
      }}
    />
  );
}

function SignDocumentInner({
  token,
  view,
  onSigned,
}: {
  token: string;
  view: SignDocumentView;
  onSigned: () => void;
}) {
  const [signerFullName, setSignerFullName] = useState(
    view.recipientFields?.signerFullName ?? "",
  );
  const [signerId, setSignerId] = useState(
    view.recipientFields?.signerId ?? "",
  );
  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] =
    useState<SubmitSigningResult | null>(null);

  const isSigned = view.status === "signed";

  const submitMutation = useMutation({
    mutationFn: (input: {
      signerFullName: string;
      signerId?: string;
      signatureSvg: string;
    }) => documentsApi.submitSigning(token, input),
    onSuccess: (result) => {
      setSuccessResult(result);
      onSigned();
    },
    onError: (err) => {
      setError(apiErrorMessage(err, "אירעה שגיאה בעת השליחה."));
    },
  });

  if (isSigned || successResult) {
    return <SuccessScreen token={token} businessName={view.businessName} />;
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signerFullName.trim()) {
      setError("יש למלא שם מלא.");
      return;
    }
    if (!signature) {
      setError("נדרשת חתימה לפני האישור.");
      return;
    }
    if (!agreed) {
      setError("יש לאשר שהמסמך נקרא והובן.");
      return;
    }
    submitMutation.mutate({
      signerFullName: signerFullName.trim(),
      signerId: signerId.trim() || undefined,
      signatureSvg: signature,
    });
  };

  return (
    <main className="warm-bg min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-4 pb-12">
        <Hero
          businessName={view.businessName}
          logoUrl={view.brand.logoUrl ?? null}
        />

        <div className="space-y-5">
          <DocumentPreviewCard view={view} />

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <Card>
              <SectionTitle hint="נא למלא את כל השדות המסומנים בכוכבית.">
                פרטי החותם
              </SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id="signerFullName"
                  label="שם מלא"
                  required
                  value={signerFullName}
                  onChange={setSignerFullName}
                  disabled={submitMutation.isPending}
                  placeholder="שם החותם כפי שמופיע בתעודת זהות"
                  autoComplete="name"
                />
                <Field
                  id="signerId"
                  label="תעודת זהות"
                  helpText="אופציונלי, 9 ספרות"
                  value={signerId}
                  onChange={setSignerId}
                  disabled={submitMutation.isPending}
                  inputMode="numeric"
                />
              </div>
            </Card>

            <Card>
              <SectionTitle hint="לחץ על המסגרת כדי להיכנס למסך החתימה.">
                חתימת לקוח
              </SectionTitle>
              <SignaturePad value={signature} onChange={setSignature} />
            </Card>

            <Card className="!bg-gradient-to-bl from-cream to-peach-50">
              <label className="flex cursor-pointer items-start gap-3">
                <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    disabled={submitMutation.isPending}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-wheat bg-white checked:border-basil-600 checked:bg-basil-600 focus:outline-none focus:ring-4 focus:ring-basil-100"
                  />
                  <svg
                    className="pointer-events-none absolute inset-0 m-auto hidden h-3.5 w-3.5 text-white peer-checked:block"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="text-sm text-wood-900">
                  אני מאשר/ת כי קראתי והבנתי את כל פרטי המסמך ותנאי השירות של{" "}
                  <span className="font-semibold">{view.businessName}</span>.
                </span>
              </label>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-tomato-500/40 bg-tomato-100/60 px-3 py-2.5 text-sm text-tomato-700">
                  <span
                    aria-hidden
                    className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-tomato-500"
                  />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="group relative mt-5 w-full overflow-hidden rounded-2xl bg-gradient-to-l from-basil-700 to-basil-600 px-5 py-4 text-base font-semibold text-white shadow-[0_8px_24px_-12px_rgba(14,139,61,0.55)] transition active:scale-[0.99] hover:from-basil-700 hover:to-basil-700 disabled:cursor-not-allowed disabled:from-wood-300 disabled:to-wood-300 disabled:shadow-none"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {submitMutation.isPending ? (
                    <>
                      <Spinner inverted />
                      שולח לחתימה...
                    </>
                  ) : (
                    <>אישור וחתימה סופית</>
                  )}
                </span>
              </button>
            </Card>
          </form>
        </div>

        <footer className="mt-10 text-center text-xs text-wood-700/50">
          <div
            className="mx-auto mb-2 flex items-center justify-center gap-1.5"
            aria-hidden="true"
          >
            <span className="block h-1 w-1 rounded-full bg-basil-600" />
            <span className="block h-1 w-6 rounded-full bg-wheat" />
            <span className="block h-1 w-1 rounded-full bg-tomato-500" />
          </div>
          © {new Date().getFullYear()} {view.businessName}
        </footer>
      </div>
    </main>
  );
}

function Hero({
  businessName,
  logoUrl,
}: {
  businessName: string;
  logoUrl: string | null;
}) {
  return (
    <header className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-peach-200 opacity-50 blur-3xl"
      />

      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-8 pb-4 text-center sm:pt-12">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={businessName}
            className="h-24 w-24 rounded-full object-cover shadow-[0_8px_32px_-12px_rgba(122,74,43,0.35)] ring-4 ring-cream sm:h-28 sm:w-28"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-cream text-3xl shadow-[0_8px_32px_-12px_rgba(122,74,43,0.35)] ring-4 ring-cream sm:h-28 sm:w-28">
            📝
          </div>
        )}
        <h1 className="font-display mt-4 text-3xl text-wood-900 sm:text-4xl">
          {businessName}
        </h1>
        <p className="mt-1 text-sm text-wood-700/80 sm:text-base">
          מסמך לאישור ולחתימה דיגיטלית
        </p>

        <div
          className="mt-4 flex items-center gap-1.5"
          aria-hidden="true"
        >
          <span className="block h-1.5 w-1.5 rounded-full bg-basil-600" />
          <span className="block h-1.5 w-6 rounded-full bg-wheat" />
          <span className="block h-1.5 w-1.5 rounded-full bg-tomato-500" />
        </div>
      </div>
    </header>
  );
}

function DocumentPreviewCard({ view }: { view: SignDocumentView }) {
  const v = view.variables;
  const currency =
    typeof v.currency === "string" && v.currency ? v.currency : "ILS";
  const fmtMoney = useMemo(
    () =>
      new Intl.NumberFormat("he-IL", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [currency],
  );
  const fmtDate = (s: unknown) => {
    if (typeof s !== "string" || !s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("he-IL");
  };

  const totalAmount = Number(v.total_amount ?? 0);
  const requiresDeposit = Boolean(v.requires_deposit);
  const depositAmount = Number(v.deposit_amount ?? 0);
  const balance = requiresDeposit
    ? Math.max(0, totalAmount - depositAmount)
    : totalAmount;

  return (
    <Card>
      <div className="mb-5 text-center">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-tomato-500">
          Documento
        </p>
        <h2 className="font-display mt-1 text-2xl text-wood-900 sm:text-3xl">
          הזמנת עבודה
        </h2>
        <div
          className="mx-auto mt-3 flex items-center justify-center gap-2"
          aria-hidden="true"
        >
          <span className="block h-px w-10 bg-wheat" />
          <span className="block h-1.5 w-1.5 rounded-full bg-tomato-500" />
          <span className="block h-px w-10 bg-wheat" />
        </div>
      </div>

      <dl className="mb-5 grid grid-cols-1 gap-4 rounded-2xl bg-peach-50/60 p-4 sm:grid-cols-2">
        <Meta label="שם הלקוח" value={String(v.client_name ?? "—")} />
        <Meta label="פרטי קשר" value={String(v.client_contact ?? "—")} />
        <Meta label="תאריך תחילה" value={fmtDate(v.start_date)} />
        <Meta label="תאריך סיום צפוי" value={fmtDate(v.delivery_date)} />
      </dl>

      <Subsection title="תיאור השירות">
        <p className="whitespace-pre-wrap leading-7 text-wood-900/85">
          {String(v.service_description ?? "—")}
        </p>
      </Subsection>

      <Subsection title="תנאי תשלום">
        <div className="rounded-2xl bg-peach-50/60 p-4 text-sm tabular">
          <div className="flex justify-between py-1">
            <span className="text-wood-700/80">סכום כולל</span>
            <span className="font-semibold text-wood-900">
              {fmtMoney.format(totalAmount)}
            </span>
          </div>
          {requiresDeposit && (
            <>
              <div className="flex justify-between py-1">
                <span className="text-wood-700/80">
                  מקדמה לתשלום בחתימה
                </span>
                <span className="font-semibold text-basil-700">
                  {fmtMoney.format(depositAmount)}
                </span>
              </div>
              <div className="my-2 border-t border-dashed border-wheat" />
              <div className="flex items-end justify-between">
                <span className="text-base font-medium text-wood-900">
                  יתרה לתשלום
                </span>
                <span className="font-display text-2xl text-tomato-600">
                  {fmtMoney.format(balance)}
                </span>
              </div>
            </>
          )}
          {!requiresDeposit && (
            <>
              <div className="my-2 border-t border-dashed border-wheat" />
              <div className="flex items-end justify-between">
                <span className="text-base font-medium text-wood-900">
                  לתשלום
                </span>
                <span className="font-display text-2xl text-tomato-600">
                  {fmtMoney.format(totalAmount)}
                </span>
              </div>
            </>
          )}
        </div>
      </Subsection>

      {typeof v.notes === "string" && v.notes && (
        <Subsection title="הערות נוספות">
          <p className="whitespace-pre-wrap leading-7 text-wood-900/85">
            {v.notes}
          </p>
        </Subsection>
      )}

      {view.boilerplate?.terms && (
        <Subsection title="תנאים והערות">
          <p className="whitespace-pre-wrap text-sm text-wood-700/80">
            {view.boilerplate.terms}
          </p>
        </Subsection>
      )}
    </Card>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-3xl border border-wheat/70 bg-cream/90 backdrop-blur-sm",
        "p-5 sm:p-7",
        "shadow-[0_8px_28px_-18px_rgba(122,74,43,0.35)]",
        "ring-1 ring-white/40",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2.5">
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden
            className="block h-2 w-2 rounded-full bg-tomato-500"
          />
          <h2 className="font-display text-xl text-wood-900 sm:text-2xl">
            {children}
          </h2>
        </div>
        <span
          aria-hidden
          className="flex-1 h-px bg-gradient-to-l from-transparent via-wheat to-wheat"
        />
      </div>
      {hint && <p className="mt-1.5 text-sm text-wood-700/70">{hint}</p>}
    </div>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="font-display mt-1 mb-2 flex items-center gap-2 text-base text-wood-900">
        <span
          aria-hidden
          className="block h-1.5 w-1.5 rounded-full bg-basil-600"
        />
        {title}
        <span
          aria-hidden
          className="ml-1 flex-1 border-t border-dashed border-wheat"
        />
      </h3>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-wood-700/60 mb-1">
        {label}
      </dt>
      <dd className="font-medium text-wood-900">{value}</dd>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  placeholder,
  helpText,
  autoComplete,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "decimal" | "tel" | "email" | "url" | "search";
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-wood-900"
      >
        {label}
        {required && <span className="text-tomato-500">*</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="w-full rounded-xl border border-wheat bg-white/80 px-3.5 py-2.5 text-base text-wood-900 outline-none transition placeholder:text-wood-700/40 shadow-[inset_0_1px_2px_rgba(122,74,43,0.04)] focus:border-basil-600 focus:ring-4 focus:ring-basil-100 disabled:cursor-not-allowed disabled:bg-peach-50 disabled:text-wood-700/60"
      />
      {helpText && (
        <p className="mt-1.5 text-xs text-wood-700/60">{helpText}</p>
      )}
    </div>
  );
}

function SuccessScreen({
  token,
  businessName,
}: {
  token: string;
  businessName: string;
}) {
  const pdfUrl = documentsApi.pdfUrl(token);
  const absolutePdfUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${pdfUrl}`
      : pdfUrl;
  const waText = `שלום! חתמתי על המסמך. הקובץ החתום: ${absolutePdfUrl}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  const [shareState, setShareState] = useState<
    "idle" | "sharing" | "shared" | "error"
  >("idle");

  const canShareFile = () => {
    try {
      return (
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [new File([], "test.pdf")] })
      );
    } catch {
      return false;
    }
  };

  const handleShare = async () => {
    setShareState("sharing");
    try {
      if (canShareFile()) {
        const res = await fetch(pdfUrl);
        const blob = await res.blob();
        const file = new File([blob], `signed-${token}.pdf`, {
          type: "application/pdf",
        });
        await navigator.share({
          files: [file],
          title: "מסמך חתום",
          text: waText,
        });
        setShareState("shared");
      } else {
        window.open(waUrl, "_blank", "noopener,noreferrer");
        setShareState("shared");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setShareState("idle");
        return;
      }
      setShareState("error");
    }
  };

  return (
    <main className="warm-bg flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-up overflow-hidden rounded-3xl bg-cream shadow-[0_24px_60px_-20px_rgba(122,74,43,0.35)] ring-1 ring-wheat">
        <div className="relative bg-gradient-to-bl from-basil-600 to-basil-700 px-6 py-7 text-center text-white">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/10">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-9 w-9"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="font-display mt-3 text-xs uppercase tracking-[0.3em] text-white/80">
            Grazie
          </p>
          <h1 className="font-display mt-1 text-2xl">המסמך נחתם בהצלחה</h1>
          <p className="mt-1 text-sm text-white/85">המסמך מוכן ומחכה לשליחה</p>
        </div>

        <div className="px-6 py-6 text-wood-900">
          <p className="text-center text-sm leading-6 text-wood-700">
            לחץ על הכפתור למטה כדי{" "}
            <strong className="text-wood-900">לשלוח את המסמך</strong> ל־
            <br />
            <span className="font-display text-base text-tomato-600">
              {businessName}
            </span>
          </p>

          <button
            type="button"
            onClick={handleShare}
            disabled={shareState === "sharing"}
            className="group relative mt-5 flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-bl from-[#25D366] to-[#1ebd5a] px-5 py-5 text-lg font-bold text-white shadow-[0_12px_32px_-12px_rgba(37,211,102,0.65)] transition active:scale-[0.98] hover:shadow-[0_16px_36px_-12px_rgba(37,211,102,0.75)] disabled:opacity-70"
          >
            {shareState === "sharing" ? (
              <>
                <Spinner inverted />
                פותח שיתוף...
              </>
            ) : (
              <>
                <WhatsAppIcon className="h-6 w-6" />
                שלח את המסמך בוואטסאפ
              </>
            )}
          </button>

          {shareState === "shared" && (
            <p className="mt-3 text-center text-sm text-basil-700">
              ✓ שותף — אפשר לסגור את החלון
            </p>
          )}
          {shareState === "error" && (
            <p className="mt-3 text-center text-sm text-tomato-600">
              לא הצלחנו לשתף. נסה להוריד ולצרף ידנית.
            </p>
          )}

          <a
            href={pdfUrl}
            download={`signed-${token}.pdf`}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-wheat bg-white/60 px-4 py-2.5 text-sm font-medium text-wood-700 hover:bg-cream"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            הורד את ה־PDF למכשיר
          </a>

          <div
            className="mt-6 flex items-center justify-center gap-1.5"
            aria-hidden="true"
          >
            <span className="block h-1 w-1 rounded-full bg-basil-600" />
            <span className="block h-1 w-8 rounded-full bg-wheat" />
            <span className="block h-1 w-1 rounded-full bg-tomato-500" />
          </div>
        </div>
      </div>
    </main>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="warm-bg min-h-screen flex items-center justify-center px-4 text-center">
      <div className="max-w-md rounded-3xl border border-wheat/70 bg-cream/90 px-6 py-10 shadow-[0_8px_28px_-18px_rgba(122,74,43,0.35)]">
        {children}
      </div>
    </main>
  );
}

function Spinner({ inverted = false }: { inverted?: boolean }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-t-transparent ${
        inverted ? "border-white/40" : "border-wood-700/40"
      }`}
      role="status"
      aria-label="loading"
    />
  );
}

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479c0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 22h-.05a9.94 9.94 0 01-5.07-1.382L1 22l1.422-5.834a9.93 9.93 0 01-1.55-5.318C.872 5.336 5.418.788 11.05.788h.005c2.701 0 5.235 1.052 7.142 2.962a9.96 9.96 0 012.962 7.146c-.003 5.514-4.549 10.06-10.109 10.06z" />
    </svg>
  );
}

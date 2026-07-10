import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiErrorMessage } from "../api/client";
import { questionnaireApi } from "../api/questionnaire";
import {
  buildPayload,
  isFieldVisible,
  OTHER,
  STEPS,
  validateStep,
  type Answers,
  type Field,
} from "../questionnaire/schema";

// Brand tokens mirrored from the marketing site (portalstudio.co.il /start):
// warm beige surface, navy headings, coral CTA, steel-blue accents.
const NAVY = "#062340";
const CORAL = "#DC5D46";
const STEEL = "#6091B0";

export default function Questionnaire() {
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const hp = useRef(""); // honeypot — set only by bots
  const topRef = useRef<HTMLDivElement>(null);

  const total = STEPS.length;
  const step = STEPS[stepIndex];
  const isLast = stepIndex === total - 1;
  const progress = Math.round(((stepIndex + 1) / total) * 100);

  const submit = useMutation({
    mutationFn: () => questionnaireApi.submit(buildPayload(answers, hp.current)),
    onSuccess: () => setDone(true),
    onError: (err) =>
      setError(apiErrorMessage(err, "אירעה שגיאה בשליחה. נסה שוב.")),
  });

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stepIndex, done]);

  const setValue = (id: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    if (error) setError(null);
  };

  const visibleFields = useMemo(
    () => step.fields.filter((f) => isFieldVisible(f, answers)),
    [step, answers],
  );

  const goNext = () => {
    const err = validateStep(step, answers);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (isLast) submit.mutate();
    else setStepIndex((i) => Math.min(i + 1, total - 1));
  };

  const goBack = () => {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  if (done) return <ThankYou />;

  return (
    <main
      className="font-alef relative min-h-dvh overflow-hidden"
      style={{ backgroundColor: "#F0E1D5", color: "#1a1a2e" }}
    >
      <Decoration />

      <div
        ref={topRef}
        className="relative mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:pt-8"
      >
        <LogoHeader />

        {stepIndex === 0 && <Hero />}

        <ProgressBar
          current={stepIndex + 1}
          total={total}
          progress={progress}
          title={step.title}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            goNext();
          }}
          noValidate
        >
          {/* Honeypot: hidden from humans, catches autofill bots. */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            defaultValue=""
            onChange={(e) => (hp.current = e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          {/* Double-bezel card, mirroring the marketing lead form. */}
          <div
            className="mt-6 rounded-[2.25rem] p-2"
            style={{
              backgroundColor: "rgba(6,35,64,0.05)",
              border: "1px solid rgba(6,35,64,0.08)",
            }}
          >
            <div
              className="rounded-[1.75rem] bg-white px-5 py-7 sm:px-8 sm:py-9"
              style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6)" }}
            >
              <div className="mb-6">
                <h2
                  className="font-heebo text-2xl font-black sm:text-3xl"
                  style={{ color: NAVY }}
                >
                  {step.title}
                </h2>
                {step.subtitle && (
                  <p
                    className="mt-1.5 text-[15px]"
                    style={{ color: "rgba(6,35,64,0.6)" }}
                  >
                    {step.subtitle}
                  </p>
                )}
              </div>

              <div className="space-y-7">
                {visibleFields.map((field) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    answers={answers}
                    onChange={setValue}
                  />
                ))}
              </div>

              {error && (
                <div
                  className="mt-6 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "rgba(220,93,70,0.08)",
                    color: "#C24A34",
                  }}
                >
                  <span
                    aria-hidden
                    className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CORAL }}
                  />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={submit.isPending}
                className="font-heebo rounded-full px-6 py-4 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60"
                style={{ color: NAVY, border: "1.5px solid rgba(6,35,64,0.2)" }}
              >
                חזרה
              </button>
            )}
            <button
              type="submit"
              disabled={submit.isPending}
              className="btn-glow font-heebo flex-1 rounded-full px-6 py-4 text-base font-semibold text-white active:scale-[0.98] disabled:opacity-70"
              style={{ backgroundColor: CORAL }}
            >
              <span className="flex items-center justify-center gap-2">
                {submit.isPending ? (
                  <>
                    <Spinner />
                    שולח...
                  </>
                ) : isLast ? (
                  "שליחת השאלון"
                ) : (
                  "המשך"
                )}
              </span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function FieldRenderer({
  field,
  answers,
  onChange,
}: {
  field: Field;
  answers: Answers;
  onChange: (id: string, value: string | string[]) => void;
}) {
  const value = answers[field.id];
  const inputCls =
    "w-full rounded-2xl border bg-white px-4 py-3.5 text-[15px] outline-none transition focus:border-[#6091B0] focus:ring-4 focus:ring-[#6091B0]/15";
  const inputStyle = {
    borderColor: "rgba(6,35,64,0.15)",
    color: "#1a1a2e",
  } as const;

  return (
    <div>
      <label className="font-heebo mb-2 flex items-baseline gap-1.5 text-[15px] font-semibold" style={{ color: NAVY }}>
        <span>{field.label}</span>
        {!field.required && (
          <span className="text-xs font-normal" style={{ color: "rgba(6,35,64,0.4)" }}>
            (רשות)
          </span>
        )}
      </label>
      {field.help && (
        <p className="-mt-1 mb-2.5 text-sm" style={{ color: "rgba(6,35,64,0.5)" }}>
          {field.help}
        </p>
      )}

      {field.type === "textarea" && (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={inputCls}
          style={inputStyle}
        />
      )}
      {field.type === "text" && (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          inputMode={field.inputMode === "text" ? undefined : field.inputMode}
          dir={field.inputMode === "email" || field.inputMode === "tel" ? "ltr" : undefined}
          className={inputCls}
          style={{ ...inputStyle, textAlign: field.inputMode === "email" || field.inputMode === "tel" ? "start" : undefined }}
        />
      )}

      {field.type === "radio" && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {field.options?.map((opt) => (
            <OptionCard
              key={opt.value}
              type="radio"
              label={opt.label}
              checked={value === opt.value}
              onClick={() => onChange(field.id, opt.value)}
            />
          ))}
        </div>
      )}

      {field.type === "checkbox" && (
        <CheckboxGroup field={field} answers={answers} onChange={onChange} />
      )}
    </div>
  );
}

function CheckboxGroup({
  field,
  answers,
  onChange,
}: {
  field: Field;
  answers: Answers;
  onChange: (id: string, value: string | string[]) => void;
}) {
  const selected = (answers[field.id] as string[]) ?? [];
  const atLimit =
    typeof field.maxSelect === "number" && selected.length >= field.maxSelect;

  const toggle = (val: string) => {
    const has = selected.includes(val);
    if (!has && atLimit) return;
    const next = has ? selected.filter((v) => v !== val) : [...selected, val];
    onChange(field.id, next);
  };

  const options = [
    ...(field.options ?? []),
    ...(field.allowOther ? [{ value: OTHER, label: "אחר" }] : []),
  ];

  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <OptionCard
              key={opt.value}
              type="checkbox"
              label={opt.label}
              checked={checked}
              disabled={!checked && atLimit}
              onClick={() => toggle(opt.value)}
            />
          );
        })}
      </div>
      {field.allowOther && selected.includes(OTHER) && (
        <input
          type="text"
          value={(answers[`${field.id}_other`] as string) ?? ""}
          onChange={(e) => onChange(`${field.id}_other`, e.target.value)}
          placeholder="פרט..."
          className="mt-2.5 w-full rounded-2xl border bg-white px-4 py-3.5 text-[15px] outline-none transition focus:border-[#6091B0] focus:ring-4 focus:ring-[#6091B0]/15"
          style={{ borderColor: "rgba(6,35,64,0.15)", color: "#1a1a2e" }}
        />
      )}
      {typeof field.maxSelect === "number" && (
        <p className="mt-2 text-xs" style={{ color: "rgba(6,35,64,0.45)" }}>
          נבחרו {selected.length} מתוך {field.maxSelect}
        </p>
      )}
    </div>
  );
}

function OptionCard({
  label,
  checked,
  disabled,
  onClick,
  type,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
  type: "radio" | "checkbox";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={checked}
      className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-start text-[15px] transition disabled:cursor-not-allowed"
      style={{
        borderColor: checked ? STEEL : "rgba(6,35,64,0.15)",
        backgroundColor: checked ? "rgba(96,145,176,0.10)" : "#ffffff",
        boxShadow: checked ? `0 0 0 3px rgba(96,145,176,0.18)` : "none",
        color: checked ? NAVY : "#1a1a2e",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center border-2 transition"
        style={{
          borderRadius: type === "radio" ? "9999px" : "0.5rem",
          borderColor: checked ? STEEL : "rgba(6,35,64,0.3)",
          backgroundColor: checked ? STEEL : "#ffffff",
        }}
      >
        {checked && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3 text-white"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span className="leading-tight">{label}</span>
    </button>
  );
}

function ProgressBar({
  current,
  total,
  progress,
  title,
}: {
  current: number;
  total: number;
  progress: number;
  title: string;
}) {
  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-heebo text-sm font-semibold" style={{ color: NAVY }}>
          {title}
        </span>
        <span className="text-sm" style={{ color: "rgba(6,35,64,0.5)" }}>
          שלב {current} מתוך {total}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "rgba(96,145,176,0.20)" }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, backgroundColor: STEEL }}
        />
      </div>
    </div>
  );
}

function LogoHeader() {
  return (
    <div className="flex justify-center">
      <div
        className="flex items-center gap-2.5 rounded-full px-3.5 py-2"
        style={{
          backgroundColor: "rgba(240,225,213,0.72)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(6,35,64,0.08)",
          boxShadow: "0 12px 32px -16px rgba(6,35,64,0.18)",
        }}
      >
        <img
          src="/brand/portal-icon-256.png"
          alt="Portal Studio"
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
        />
        <span
          className="font-heebo text-lg font-bold tracking-tight sm:text-xl"
          style={{ color: NAVY }}
        >
          PORTAL STUDIO
        </span>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <header className="mt-7 text-center">
      <p
        className="font-heebo text-[11px] font-medium uppercase tracking-[0.2em]"
        style={{ color: STEEL }}
      >
        אבחון שיווקי
      </p>
      <h1
        className="font-heebo mt-3 font-black leading-[1.1] tracking-tight"
        style={{ fontSize: "clamp(2rem, 6vw, 3rem)", color: NAVY }}
      >
        שאלון אסטרטגיית <span style={{ color: CORAL }}>שיווק</span>
      </h1>
      <p
        className="mx-auto mt-3 max-w-md text-base leading-relaxed"
        style={{ color: "rgba(6,35,64,0.65)" }}
      >
        כמה שאלות קצרות שיעזרו לנו להכיר את העסק שלך לעומק — ולבנות עבורך תוכנית
        שיווק שמתאימה בדיוק לך. מילוי של כ־6 דקות.
      </p>
    </header>
  );
}

/** Ambient brand glow — steel + coral, echoing the site's decorative orbs. */
function Decoration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      <div
        className="absolute -top-32 -left-28 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(96,145,176,0.30), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(220,93,70,0.16), transparent 70%)" }}
      />
    </div>
  );
}

function ThankYou() {
  return (
    <main
      className="font-alef relative flex min-h-dvh items-center justify-center overflow-hidden px-4"
      style={{ backgroundColor: "#F0E1D5", color: "#1a1a2e" }}
    >
      <Decoration />
      <div className="animate-fade-up relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <LogoHeader />
        </div>
        <div
          className="rounded-[2.25rem] p-2"
          style={{
            backgroundColor: "rgba(6,35,64,0.05)",
            border: "1px solid rgba(6,35,64,0.08)",
          }}
        >
          <div
            className="rounded-[1.75rem] bg-white px-8 py-10 text-center"
            style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6)" }}
          >
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(96,145,176,0.14)" }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke={STEEL}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-9 w-9"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="font-heebo mt-5 text-2xl font-black" style={{ color: NAVY }}>
              התשובות נשלחו בהצלחה! 🎉
            </h1>
            <p className="mt-3 text-[15px] leading-7" style={{ color: "rgba(6,35,64,0.65)" }}>
              אנחנו ב-Portal Studio נעבד את המידע ונחזור אליך בהקדם האפשרי עם
              הצעה לאסטרטגיית שיווק שאנחנו מאמינים שהכי נכונה לך ולעסק שלך.
              תודה 🙏
            </p>
            <p className="font-heebo mt-6 text-sm font-bold tracking-tight" style={{ color: CORAL }}>
              PORTAL STUDIO
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent"
      role="status"
      aria-label="שולח"
    />
  );
}

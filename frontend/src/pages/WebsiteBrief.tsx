import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiErrorMessage } from "../api/client";
import { websiteIntakeApi } from "../api/websiteIntake";
import { Icon } from "../components/icons";
import {
  buildPayload,
  MAX_IMAGES,
  OTHER,
  STEPS,
  validateStep,
  type Answers,
  type Field,
} from "../website-intake/schema";

// Brand tokens mirrored from the marketing site (same as /strategy).
const NAVY = "#062340";
const CORAL = "#DC5D46";
const STEEL = "#6091B0";

const ACCEPT_IMAGE = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif";
const MAX_FILE_BYTES = 12 * 1024 * 1024;

export default function WebsiteBrief() {
  const [answers, setAnswers] = useState<Answers>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pdfToken, setPdfToken] = useState<string | null>(null);
  const hp = useRef(""); // honeypot — set only by bots
  const topRef = useRef<HTMLDivElement>(null);

  const total = STEPS.length;
  const step = STEPS[stepIndex];
  const isLast = stepIndex === total - 1;
  const progress = Math.round(((stepIndex + 1) / total) * 100);

  const submit = useMutation({
    mutationFn: () =>
      websiteIntakeApi.submit(
        buildPayload(answers, hp.current),
        logoFile,
        imageFiles,
      ),
    onSuccess: (data) => {
      setPdfToken(data.pdfToken ?? null);
      setDone(true);
    },
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

  const visibleFields = useMemo(() => step.fields, [step]);

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

  if (done) return <ThankYou pdfToken={pdfToken} />;

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
                    logoFile={logoFile}
                    onLogo={setLogoFile}
                    imageFiles={imageFiles}
                    onImages={setImageFiles}
                    onError={setError}
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
                  "שליחת הבריף"
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
  logoFile,
  onLogo,
  imageFiles,
  onImages,
  onError,
}: {
  field: Field;
  answers: Answers;
  onChange: (id: string, value: string | string[]) => void;
  logoFile: File | null;
  onLogo: (f: File | null) => void;
  imageFiles: File[];
  onImages: (f: File[]) => void;
  onError: (msg: string) => void;
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
      <label
        className="font-heebo mb-2 flex items-baseline gap-1.5 text-[15px] font-semibold"
        style={{ color: NAVY }}
      >
        <span>{field.label}</span>
        {!field.required && (
          <span
            className="text-xs font-normal"
            style={{ color: "rgba(6,35,64,0.4)" }}
          >
            (רשות)
          </span>
        )}
      </label>
      {field.help && (
        <p
          className="-mt-1 mb-2.5 text-sm"
          style={{ color: "rgba(6,35,64,0.5)" }}
        >
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
          dir={
            field.inputMode === "email" || field.inputMode === "tel"
              ? "ltr"
              : undefined
          }
          className={inputCls}
          style={{
            ...inputStyle,
            textAlign:
              field.inputMode === "email" || field.inputMode === "tel"
                ? "start"
                : undefined,
          }}
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

      {field.type === "logo" && (
        <LogoUpload
          file={logoFile}
          onFile={onLogo}
          onError={onError}
        />
      )}

      {field.type === "images" && (
        <ImagesUpload
          files={imageFiles}
          onFiles={onImages}
          onError={onError}
        />
      )}
    </div>
  );
}

function validateFile(file: File, onError: (m: string) => void): boolean {
  if (!file.type.startsWith("image/")) {
    onError(`הקובץ "${file.name}" אינו תמונה`);
    return false;
  }
  if (file.size > MAX_FILE_BYTES) {
    onError(`הקובץ "${file.name}" גדול מדי (עד 12MB)`);
    return false;
  }
  return true;
}

function LogoUpload({
  file,
  onFile,
  onError,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  onError: (m: string) => void;
}) {
  const preview = useObjectUrl(file);
  return (
    <div>
      {file ? (
        <div
          className="flex items-center gap-3 rounded-2xl border bg-white p-3"
          style={{ borderColor: "rgba(6,35,64,0.15)" }}
        >
          <img
            src={preview}
            alt="לוגו"
            className="h-14 w-14 rounded-xl object-contain"
            style={{ backgroundColor: "rgba(6,35,64,0.04)" }}
          />
          <span className="min-w-0 flex-1 truncate text-sm" style={{ color: NAVY }}>
            {file.name}
          </span>
          <button
            type="button"
            onClick={() => onFile(null)}
            className="rounded-full p-1.5 transition hover:bg-black/5"
            aria-label="הסר לוגו"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : (
        <UploadDrop
          label="בחר קובץ לוגו"
          onFiles={(files) => {
            const f = files[0];
            if (f && validateFile(f, onError)) onFile(f);
          }}
        />
      )}
    </div>
  );
}

function ImagesUpload({
  files,
  onFiles,
  onError,
}: {
  files: File[];
  onFiles: (f: File[]) => void;
  onError: (m: string) => void;
}) {
  const addFiles = (incoming: File[]) => {
    const room = MAX_IMAGES - files.length;
    if (room <= 0) {
      onError(`אפשר להעלות עד ${MAX_IMAGES} תמונות`);
      return;
    }
    const valid = incoming.filter((f) => validateFile(f, onError));
    onFiles([...files, ...valid].slice(0, MAX_IMAGES));
  };

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {files.map((f, i) => (
            <ImageThumb
              key={`${f.name}-${i}`}
              file={f}
              onRemove={() => onFiles(files.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
      )}
      {files.length < MAX_IMAGES && (
        <UploadDrop
          label={`הוסף תמונות (${files.length}/${MAX_IMAGES})`}
          multiple
          onFiles={addFiles}
        />
      )}
    </div>
  );
}

function ImageThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const preview = useObjectUrl(file);
  return (
    <div
      className="group relative aspect-square overflow-hidden rounded-xl border"
      style={{ borderColor: "rgba(6,35,64,0.12)" }}
    >
      <img src={preview} alt={file.name} className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute end-1 top-1 rounded-full bg-white/90 p-1 shadow-sm transition hover:bg-white"
        aria-label="הסר תמונה"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

function UploadDrop({
  label,
  multiple,
  onFiles,
}: {
  label: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-sm font-medium transition hover:bg-black/[0.02]"
        style={{ borderColor: "rgba(96,145,176,0.5)", color: STEEL }}
      >
        <Icon name="upload" size={20} />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_IMAGE}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          if (list.length) onFiles(list);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** Creates (and revokes) an object URL for a file preview. */
function useObjectUrl(file: File | null): string | undefined {
  const url = useMemo(
    () => (file ? URL.createObjectURL(file) : undefined),
    [file],
  );
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
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
        {checked && <Icon name="check" size={11} className="text-white" />}
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
        <span
          className="font-heebo text-sm font-semibold"
          style={{ color: NAVY }}
        >
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
        בריף לבניית אתר
      </p>
      <h1
        className="font-heebo mt-3 font-black leading-[1.1] tracking-tight"
        style={{ fontSize: "clamp(2rem, 6vw, 3rem)", color: NAVY }}
      >
        הפרטים שנבנה מהם את <span style={{ color: CORAL }}>האתר שלך</span>
      </h1>
      <p
        className="mx-auto mt-3 max-w-md text-base leading-relaxed"
        style={{ color: "rgba(6,35,64,0.65)" }}
      >
        כמה שאלות שיתנו לנו את כל המידע לבניית האתר — פרטי העסק, מוצרים ומחירים,
        לוגו ותמונות. מילוי של כ־7 דקות.
      </p>
    </header>
  );
}

function Decoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
    >
      <div
        className="absolute -top-32 -left-28 h-96 w-96 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(96,145,176,0.30), transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(220,93,70,0.16), transparent 70%)",
        }}
      />
    </div>
  );
}

function ThankYou({ pdfToken }: { pdfToken: string | null }) {
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
              style={{ backgroundColor: "rgba(96,145,176,0.14)", color: STEEL }}
            >
              <Icon name="check" size={34} />
            </div>
            <h1
              className="font-heebo mt-5 text-2xl font-black"
              style={{ color: NAVY }}
            >
              הבריף נשלח בהצלחה!
            </h1>
            <p
              className="mt-3 text-[15px] leading-7"
              style={{ color: "rgba(6,35,64,0.65)" }}
            >
              קיבלנו את כל הפרטים ואת הקבצים. נתחיל לעבוד על האתר ונחזור אליך עם
              עדכון בהקדם. תודה!
            </p>

            {pdfToken && (
              <a
                href={websiteIntakeApi.publicPdfUrl(pdfToken)}
                target="_blank"
                rel="noreferrer"
                className="font-heebo mt-6 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                style={{ backgroundColor: NAVY }}
              >
                <Icon name="download" size={18} />
                הורדת הבריף כ־PDF
              </a>
            )}

            <p
              className="font-heebo mt-6 text-sm font-bold tracking-tight"
              style={{ color: CORAL }}
            >
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

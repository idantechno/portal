import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../../api/client";
import {
  type Expense,
  type ExpenseKind,
  expensesApi,
} from "../../../api/expenses";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormError,
  IconTile,
  Spinner,
} from "../../../components/ui";
import type { IconName } from "../../../components/icons";

function shekels(cents: number | null): string {
  if (cents == null) return "—";
  return `₪${(cents / 100).toLocaleString("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function countLabel(n: number): string {
  return n === 1 ? "רשומה אחת" : `${n} רשומות`;
}

const ACCEPT = ".pdf,.txt,.csv,image/*,application/pdf,text/plain";

/**
 * The full expenses experience. Two zones with a deliberate visual contrast so
 * a non-technical owner always knows where he *adds* data vs where he *reads*
 * it: a brand-tinted "העלאה" input card on top (drag-drop / OCR), then two
 * white, individually-bounded record cards — קבועות and מזדמנות — each with its
 * own total, count and empty state. Content only; the כסף page owns the header
 * + tabs. Backend logic is unchanged from the former standalone Expenses page.
 */
export default function ExpensesSection({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<"auto" | ExpenseKind>("auto");
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["expenses", businessId],
    queryFn: () => expensesApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["expenses", businessId] });
    void qc.invalidateQueries({ queryKey: ["expenses", "summary", businessId] });
  };

  const upload = useMutation({
    mutationFn: (file: File) =>
      expensesApi.create(businessId, {
        file,
        kind: uploadKind === "auto" ? undefined : uploadKind,
      }),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e, "ההעלאה נכשלה")),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; patch: Parameters<typeof expensesApi.update>[2] }) =>
      expensesApi.update(businessId, v.id, v.patch),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e, "העדכון נכשל")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => expensesApi.remove(businessId, id),
    onSuccess: invalidate,
  });

  function onFiles(files: FileList | null) {
    setError(null);
    if (!files) return;
    Array.from(files).forEach((f) => upload.mutate(f));
  }

  async function viewFile(id: string) {
    try {
      const blob = await expensesApi.fetchBlob(businessId, id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setError("לא ניתן לפתוח את הקובץ");
    }
  }

  const rows = list.data ?? [];
  const fixed = rows.filter((r) => r.kind === "fixed");
  const occasional = rows.filter((r) => r.kind === "occasional");
  const sum = (rs: Expense[]) => rs.reduce((t, r) => t + (r.amountCents ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* ── INPUT: add a receipt ─────────────────────────────────────────
          Brand-tinted, dashed drop zone. The tint + "הוספה" eyebrow mark this
          as the one place data goes IN, distinct from the white lists below. */}
      <Card
        className="border-2 border-dashed border-brand-200 bg-brand-50/40 p-5 sm:p-6"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-start gap-3">
          <IconTile icon="upload" tone="brand" />
          <div className="min-w-0">
            <div className="eyebrow text-brand-500 mb-0.5">הוספה</div>
            <h2 className="font-display text-lg text-navy-900">
              העלאת קבלה או חשבונית
            </h2>
            <p className="text-sm text-navy-500 mt-0.5">
              גרור לכאן קובץ או בחר מהמחשב — נזהה את הסכום אוטומטית. נתמך: PDF,
              תמונה או קובץ טקסט.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-navy-500 mb-1.5">
              סוג ההוצאה
            </div>
            <div className="flex items-center gap-2">
              {(
                [
                  ["auto", "זהה אוטומטית"],
                  ["fixed", "קבועה"],
                  ["occasional", "מזדמנת"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setUploadKind(k)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    uploadKind === k
                      ? "bg-brand-600 text-white"
                      : "bg-white text-navy-500 ring-1 ring-inset ring-navy-100 hover:bg-cream-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Button
            icon="upload"
            onClick={() => fileInput.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? <Spinner /> : "בחר קובץ"}
          </Button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        {upload.isPending && (
          <div className="mt-4 flex items-center gap-2 text-xs text-navy-400">
            <Spinner /> קורא את המסמך ומחלץ את הסכום...
          </div>
        )}
        {error && (
          <div className="mt-4">
            <FormError message={error} />
          </div>
        )}
      </Card>

      {/* ── VIEW: the records, grouped and bounded ───────────────────────── */}
      <ExpenseGroup
        title="הוצאות קבועות"
        hint="חוזרות כל חודש — חשמל, ארנונה, שכירות…"
        icon="refresh"
        tone="brand"
        rows={fixed}
        total={sum(fixed)}
        loading={list.isLoading}
        onKind={(id, kind) => update.mutate({ id, patch: { kind } })}
        onAmount={(id, amountCents) => update.mutate({ id, patch: { amountCents } })}
        onView={viewFile}
        onDelete={(id) => remove.mutate(id)}
        onUpload={() => fileInput.current?.click()}
      />
      <ExpenseGroup
        title="הוצאות מזדמנות"
        hint="חד-פעמיות — ציוד, תיקונים, רכישות חד-פעמיות…"
        icon="receipt"
        tone="secondary"
        rows={occasional}
        total={sum(occasional)}
        loading={list.isLoading}
        onKind={(id, kind) => update.mutate({ id, patch: { kind } })}
        onAmount={(id, amountCents) => update.mutate({ id, patch: { amountCents } })}
        onView={viewFile}
        onDelete={(id) => remove.mutate(id)}
        onUpload={() => fileInput.current?.click()}
      />
    </div>
  );
}

/** One bounded, titled record group (קבועות / מזדמנות) with its own total. */
function ExpenseGroup({
  title,
  hint,
  icon,
  tone,
  rows,
  total,
  loading,
  onKind,
  onAmount,
  onView,
  onDelete,
  onUpload,
}: {
  title: string;
  hint: string;
  icon: IconName;
  tone: "brand" | "secondary";
  rows: Expense[];
  total: number;
  loading: boolean;
  onKind: (id: string, kind: ExpenseKind) => void;
  onAmount: (id: string, amountCents: number) => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onUpload: () => void;
}) {
  const count = rows.length;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="flex items-start gap-3 min-w-0">
          <IconTile icon={icon} tone={tone} size="sm" />
          <div className="min-w-0">
            <h3 className="font-display text-lg text-navy-900">{title}</h3>
            <p className="text-xs text-navy-400 mt-0.5">{hint}</p>
          </div>
        </div>
        {count > 0 && (
          <div className="text-end shrink-0">
            <div className="tabular text-xl font-bold text-navy-900">
              {shekels(total)}
            </div>
            <div className="text-[11px] text-navy-400 mt-0.5">
              {countLabel(count)}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center border-t border-navy-100 py-8">
          <Spinner />
        </div>
      ) : count === 0 ? (
        <div className="border-t border-navy-100">
          <EmptyState
            icon="receipt"
            title="אין כאן הוצאות עדיין"
            text={hint}
            action={
              <Button
                size="sm"
                variant="secondary"
                icon="upload"
                onClick={onUpload}
              >
                העלה קובץ
              </Button>
            }
          />
        </div>
      ) : (
        <div className="border-t border-navy-100 divide-y divide-navy-50">
          {rows.map((r) => (
            <ExpenseRow
              key={r.id}
              row={r}
              onKind={onKind}
              onAmount={onAmount}
              onView={onView}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ExpenseRow({
  row,
  onKind,
  onAmount,
  onView,
  onDelete,
}: {
  row: Expense;
  onKind: (id: string, kind: ExpenseKind) => void;
  onAmount: (id: string, amountCents: number) => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [amount, setAmount] = useState(
    row.amountCents != null ? String(row.amountCents / 100) : "",
  );
  const otherKind: ExpenseKind = row.kind === "fixed" ? "occasional" : "fixed";

  function saveAmount() {
    const n = parseFloat(amount);
    const cents = Number.isFinite(n) ? Math.round(n * 100) : null;
    if (cents != null && cents !== row.amountCents) onAmount(row.id, cents);
  }

  return (
    <div className="px-5 py-3.5 sm:px-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-navy-900 truncate">
          {row.title}
        </div>
        <div className="text-[11px] text-navy-400">
          {row.expenseDate
            ? new Date(row.expenseDate).toLocaleDateString("he-IL")
            : new Date(row.createdAt).toLocaleDateString("he-IL")}
          {row.status === "failed" && (
            <span className="text-coral-600"> · לא זוהה סכום — הזן ידנית</span>
          )}
          {row.status === "parsed" && (
            <span className="text-teal-600"> · זוהה אוטומטית</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-navy-400 text-sm">₪</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={saveAmount}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          inputMode="decimal"
          placeholder="0"
          dir="ltr"
          className="w-24 rounded-lg border border-navy-200 bg-white px-2 py-1 text-sm text-left focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
      </div>

      <button
        onClick={() => onKind(row.id, otherKind)}
        title="החלף סוג"
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <Badge tone={row.kind === "fixed" ? "brand" : "neutral"}>
          {row.kind === "fixed" ? "קבועה" : "מזדמנת"}
        </Badge>
      </button>

      {row.relativePath && (
        <button
          onClick={() => onView(row.id)}
          className="text-[11px] text-brand-600 hover:underline"
        >
          צפה
        </button>
      )}
      <button
        onClick={() => onDelete(row.id)}
        className="text-[11px] text-navy-400 hover:text-coral-600"
      >
        מחק
      </button>
    </div>
  );
}

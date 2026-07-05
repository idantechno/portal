import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import {
  type Expense,
  type ExpenseKind,
  expensesApi,
} from "../../api/expenses";
import { Button, Card, FormError, Spinner } from "../../components/ui";

function shekels(cents: number | null): string {
  if (cents == null) return "—";
  return `₪${(cents / 100).toLocaleString("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const ACCEPT = ".pdf,.txt,.csv,image/*,application/pdf,text/plain";

export default function Expenses() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<"auto" | ExpenseKind>("auto");
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["expenses", businessId],
    queryFn: () => expensesApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const summary = useQuery({
    queryKey: ["expenses", "summary", businessId],
    queryFn: () => expensesApi.summary(businessId),
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
  const s = summary.data;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-display text-navy-900">
          מעקב הוצאות
        </h1>
        <p className="text-navy-500 mt-1">
          העלה חשבונית / קבלה / צילום — המערכת תקרא את הסכום ותתייק. הסכום זורם
          למאזן בדף הבית.
        </p>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SumCard
          label="קבועות (חודשי)"
          value={shekels(s?.fixedMonthlyCents ?? 0)}
          sub={`${s?.fixedCount ?? 0} הוצאות קבועות`}
          brand="--brand-primary"
        />
        <SumCard
          label="מזדמנות החודש"
          value={shekels(s?.occasionalThisMonthCents ?? 0)}
          sub={`${s?.occasionalCount ?? 0} הוצאות מזדמנות`}
          brand="--brand-secondary"
        />
        <SumCard
          label="סה״כ החודש"
          value={shekels(s?.monthlyTotalCents ?? 0)}
          sub="קבועות + מזדמנות"
          brand="--brand-accent"
        />
      </div>

      {/* Upload */}
      <Card
        className="p-5 mb-6 border-dashed border-2 border-navy-200 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
      >
        <div className="text-3xl mb-2">🧾</div>
        <div className="font-semibold text-navy-900 mb-1">
          גרור לכאן קובץ, או העלה
        </div>
        <p className="text-xs text-navy-400 mb-3">
          נתמך: PDF, תמונה (JPG/PNG…) וקובץ טקסט.
        </p>
        <div className="flex items-center justify-center gap-2 mb-3">
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
                  : "bg-cream-50 text-navy-500 hover:bg-cream-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => fileInput.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? <Spinner /> : "בחר קובץ"}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        {upload.isPending && (
          <div className="text-xs text-navy-400 mt-3 flex items-center justify-center gap-2">
            <Spinner /> קורא את המסמך ומחלץ את הסכום...
          </div>
        )}
        <FormError message={error} />
      </Card>

      {/* Lists */}
      <ExpenseSection
        title="הוצאות קבועות"
        hint="חוזרות כל חודש — חשמל, ארנונה, שכירות…"
        rows={fixed}
        loading={list.isLoading}
        onKind={(id, kind) => update.mutate({ id, patch: { kind } })}
        onAmount={(id, amountCents) =>
          update.mutate({ id, patch: { amountCents } })
        }
        onView={viewFile}
        onDelete={(id) => remove.mutate(id)}
      />
      <ExpenseSection
        title="הוצאות מזדמנות"
        hint="חד-פעמיות"
        rows={occasional}
        loading={list.isLoading}
        onKind={(id, kind) => update.mutate({ id, patch: { kind } })}
        onAmount={(id, amountCents) =>
          update.mutate({ id, patch: { amountCents } })
        }
        onView={viewFile}
        onDelete={(id) => remove.mutate(id)}
      />
    </div>
  );
}

function SumCard({
  label,
  value,
  sub,
  brand,
}: {
  label: string;
  value: string;
  sub: string;
  brand: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-navy-400 mb-1">{label}</div>
          <div className="text-2xl font-bold text-navy-900">{value}</div>
          <div className="text-[11px] text-navy-400 mt-1">{sub}</div>
        </div>
        <div
          className="h-11 w-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
          style={{
            backgroundColor: `color-mix(in srgb, var(${brand}) 14%, white)`,
          }}
        >
          💸
        </div>
      </div>
    </Card>
  );
}

function ExpenseSection({
  title,
  hint,
  rows,
  loading,
  onKind,
  onAmount,
  onView,
  onDelete,
}: {
  title: string;
  hint: string;
  rows: Expense[];
  loading: boolean;
  onKind: (id: string, kind: ExpenseKind) => void;
  onAmount: (id: string, amountCents: number) => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-navy-700 mb-1">{title}</h2>
      <p className="text-xs text-navy-400 mb-3">{hint}</p>
      {loading ? (
        <Card className="p-6 flex justify-center">
          <Spinner />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-navy-400 text-sm">
          אין כאן הוצאות עדיין.
        </Card>
      ) : (
        <Card className="divide-y divide-navy-50">
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
        </Card>
      )}
    </div>
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
    <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
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
          {row.status === "parsed" && <span className="text-teal-600"> · זוהה אוטומטית</span>}
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
        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
          row.kind === "fixed"
            ? "bg-brand-100 text-brand-700"
            : "bg-cream-100 text-navy-600"
        }`}
      >
        {row.kind === "fixed" ? "קבועה" : "מזדמנת"}
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

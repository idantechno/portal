import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { billingApi } from "../../api/billing";
import { billingKeys } from "../../lib/queryKeys";
import { expensesApi } from "../../api/expenses";
import { accountantApi } from "../../api/accountant";
import { Banner, Button, Card, PageHeader, Select, Spinner, StatCard } from "../../components/ui";
import { Icon, type IconName } from "../../components/icons";
import IncomeSection from "./money/IncomeSection";
import ExpensesSection from "./money/ExpensesSection";

const shekels = (cents: number) =>
  `₪${Math.round(cents / 100).toLocaleString("he-IL")}`;

type View = "income" | "expenses";

const TABS: { key: View; label: string; icon: IconName }[] = [
  { key: "income", label: "הכנסות", icon: "receipt" },
  { key: "expenses", label: "הוצאות", icon: "wallet" },
];

/**
 * The single "כסף" surface for the owner's business finances. A summary row
 * (income vs expenses this month) sits above two tabs — הכנסות (customer
 * invoices) and הוצאות (the expenses experience). The tab is URL-synced via
 * ?view= so links and refreshes land on the right side.
 */
export default function Money() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View =
    searchParams.get("view") === "expenses" ? "expenses" : "income";

  const setView = (next: View) => {
    const params = new URLSearchParams(searchParams);
    if (next === "income") params.delete("view");
    else params.set("view", next);
    setSearchParams(params, { replace: true });
  };

  const invoices = useQuery({
    queryKey: billingKeys.invoices(businessId),
    queryFn: () => billingApi.invoices(businessId),
    enabled: Boolean(businessId),
  });
  const expenseSummary = useQuery({
    queryKey: ["expenses", "summary", businessId],
    queryFn: () => expensesApi.summary(businessId),
    enabled: Boolean(businessId),
  });

  // Income = invoices paid this calendar month (mirrors the growth screen).
  const incomeCents = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return (invoices.data ?? [])
      .filter((i) => {
        if (i.status !== "paid" || !i.paidAt) return false;
        const d = new Date(i.paidAt);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .reduce((sum, i) => sum + i.amountCents, 0);
  }, [invoices.data]);

  const expensesCents = expenseSummary.data?.monthlyTotalCents ?? 0;
  const netCents = incomeCents - expensesCents;
  const incomeError = invoices.isError;
  const expensesError = expenseSummary.isError;

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 md:py-8 max-w-4xl mx-auto">
      <PageHeader
        title="כסף"
        subtitle="מקום אחד לכספי העסק — הכנסות מלקוחות מול הוצאות."
      />

      {/* Summary — income vs expenses this month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="הכנסות החודש"
          icon="growth"
          tone="brand"
          value={shekels(incomeCents)}
          sub={incomeError ? "לא ניתן לטעון נתונים כרגע" : "חשבוניות ששולמו"}
          error={incomeError}
        />
        <StatCard
          label="הוצאות החודש"
          icon="wallet"
          tone="secondary"
          value={shekels(expensesCents)}
          sub={expensesError ? "לא ניתן לטעון נתונים כרגע" : "קבועות + מזדמנות"}
          error={expensesError}
        />
        <StatCard
          label={netCents < 0 ? "מאזן החודש" : "רווח נקי החודש"}
          icon="coins"
          tone={netCents < 0 ? "coral" : "accent"}
          value={shekels(netCents)}
          sub={
            incomeError || expensesError
              ? "לא ניתן לטעון נתונים כרגע"
              : netCents < 0
                ? "ההוצאות גבוהות מההכנסות החודש"
                : "הכנסות פחות הוצאות"
          }
          error={incomeError || expensesError}
        />
      </div>

      {/* Tabs — touch-action:pan-x keeps a mobile swipe horizontal. */}
      <div className="mb-6 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-navy-100 [touch-action:pan-x]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setView(t.key)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
              view === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {view === "income" ? (
        <IncomeSection businessId={businessId} />
      ) : (
        <>
          <AccountantSendCard businessId={businessId} />
          <ExpensesSection businessId={businessId} />
        </>
      )}
    </div>
  );
}

/** Build the last N month options as {value:"YYYY-M", label:"חודש שנה"}. */
function recentMonths(n: number): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
      label: d.toLocaleDateString("he-IL", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

function AccountantSendCard({ businessId }: { businessId: string }) {
  const months = useMemo(() => recentMonths(6), []);
  const [period, setPeriod] = useState(months[0].value);

  const status = useQuery({
    queryKey: ["accountant", "status", businessId],
    queryFn: () => accountantApi.status(businessId),
    enabled: Boolean(businessId),
  });

  const sendMut = useMutation({
    mutationFn: () => {
      const [year, month] = period.split("-").map(Number);
      return accountantApi.send(businessId, { year, month });
    },
  });

  const hasRecipient = status.data?.hasEmail || status.data?.hasPhone;

  return (
    <Card className="mb-5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
          <Icon name="receipt" size={17} />
        </span>
        <span className="font-semibold text-navy-900">שליחת מסמכים לרו״ח</span>
      </div>

      {status.isLoading ? (
        <div className="py-2">
          <Spinner />
        </div>
      ) : !hasRecipient ? (
        <p className="text-sm text-navy-500">
          כדי לשלוח מסמכים, הגדר קודם נמען רו״ח (מייל/טלפון) ב
          <Link
            to={`/app/businesses/${businessId}/preferences/contacts`}
            className="text-brand-600 underline"
          >
            הגדרות ← אנשי קשר
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="text-sm text-navy-500 mb-3">
            שולח את כל ההוצאות והקבצים של החודש שנבחר + קובץ סיכום, לנמען הרו״ח
            הקבוע בלבד.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-auto"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Button
              icon="send"
              disabled={sendMut.isPending}
              onClick={() => sendMut.mutate()}
            >
              {sendMut.isPending ? <Spinner /> : "שלח לרו״ח"}
            </Button>
          </div>

          {sendMut.isError && (
            <Banner tone="danger" className="mt-3">
              השליחה נכשלה. נסה שוב.
            </Banner>
          )}
          {sendMut.isSuccess && (
            <Banner
              tone={
                sendMut.data.emailError && !sendMut.data.emailedTo
                  ? "warning"
                  : "success"
              }
              className="mt-3"
            >
              {sendMut.data.expenseCount} הוצאות · {sendMut.data.filesAttached}{" "}
              קבצים
              {sendMut.data.emailedTo
                ? ` · נשלח למייל ${sendMut.data.emailedTo}`
                : sendMut.data.emailError
                  ? " · המייל לא נשלח (בדוק חיבור Gmail)"
                  : ""}
              {sendMut.data.whatsappedTo ? ` · נשלח גם בוואטסאפ` : ""}
              {sendMut.data.missingFiles > 0
                ? ` · ${sendMut.data.missingFiles} ללא קובץ (מופיעים בסיכום)`
                : ""}
            </Banner>
          )}
        </>
      )}
    </Card>
  );
}

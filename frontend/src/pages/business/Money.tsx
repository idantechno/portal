import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { billingApi } from "../../api/billing";
import { billingKeys } from "../../lib/queryKeys";
import { expensesApi } from "../../api/expenses";
import { PageHeader, StatCard } from "../../components/ui";
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

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-navy-100">
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
        <ExpensesSection businessId={businessId} />
      )}
    </div>
  );
}

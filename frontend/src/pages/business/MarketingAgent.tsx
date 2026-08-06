import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { businessesApi } from "../../api/businesses";
import { useAuthStore } from "../../store/auth";
import { isPlatformStaff } from "../../lib/roles";
import { briefsApi, type Brief } from "../../api/briefs";
import { strategiesApi, type Strategy } from "../../api/strategies";
import { plansApi, type Plan } from "../../api/plans";
import { campaignsApi, type Campaign } from "../../api/campaigns";
import { apiErrorMessage } from "../../api/client";
import CustomersPanel from "../../components/CustomersPanel";
import {
  Button,
  Card,
  EmptyState,
  FormError,
  Spinner,
} from "../../components/ui";
import { Icon, type IconName } from "../../components/icons";

type Tab = "leads" | "customers" | "campaigns" | "reports";

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: "leads", label: "לידים", icon: "leads" },
  { key: "customers", label: "לקוחות", icon: "users" },
  { key: "campaigns", label: "קמפיינים", icon: "megaphone" },
  { key: "reports", label: "דוחות", icon: "doc" },
];

/**
 * The marketing agent's home — organised into four categories. Leads become
 * briefs; a lead promoted to a customer unlocks strategies and future reports.
 * Every generated document lands under the "דוחות" tab, and customers reuse the
 * shared customer surface so the sidebar and this agent stay in sync.
 */
export default function MarketingAgent({ businessId }: { businessId: string }) {
  const [tab, setTab] = useState<Tab>("leads");
  const [error, setError] = useState<string | null>(null);

  const agents = useQuery({
    queryKey: ["business", businessId, "agents"],
    queryFn: () => agentsApi.forBusiness(businessId),
    enabled: Boolean(businessId),
  });

  // Operator = platform staff, or a staff member who entered this business —
  // they may open any agent even when the business isn't entitled to it.
  const user = useAuthStore((s) => s.user);
  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });
  const isOperator =
    isPlatformStaff(user?.role) || (biz.data?.viaPlatformStaff ?? false);

  if (agents.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const entitled = (agents.data ?? []).some(
    (a) => a.key === "marketing" && a.entitled,
  );
  if (!entitled && !isOperator) {
    return <Navigate to={`/app/businesses/${businessId}/agents`} replace />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon name="megaphone" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">סוכן שיווק</h1>
          <p className="text-sm text-neutral-600">
            לידים הופכים לבריף; לקוח הופך את הבריף לאסטרטגיה ותוכנית. כל דוח שמופק
            נשמר תחת "דוחות".
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-navy-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setError(null);
              setTab(t.key);
            }}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <FormError message={error} />
        </div>
      )}

      {tab === "leads" && (
        <CustomersPanel businessId={businessId} stage="lead" />
      )}
      {tab === "customers" && (
        <CustomersPanel businessId={businessId} stage="customer" />
      )}
      {tab === "campaigns" && <CampaignsTab businessId={businessId} />}
      {tab === "reports" && (
        <ReportsTab businessId={businessId} onError={setError} />
      )}
    </div>
  );
}

/* ----------------------------- Campaigns tab ------------------------------ */

function CampaignsTab({ businessId }: { businessId: string }) {
  const navigate = useNavigate();
  const campaigns = useQuery({
    queryKey: ["campaigns", businessId],
    queryFn: () => campaignsApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const items = campaigns.data ?? [];

  if (campaigns.isLoading) {
    return <div className="text-sm text-neutral-500">טוען…</div>;
  }

  if (items.length === 0) {
    return (
      <Card className="p-10">
        <EmptyState
          icon="megaphone"
          title="אין עדיין קמפיינים"
          text="קמפיין נוצר מתוך כרטיס לקוח (טאב לקוחות → לקוח), אחרי שכל דרישות הקדם מתקיימות."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((c) => (
        <button
          key={c.id}
          onClick={() =>
            navigate(`/app/businesses/${businessId}/campaigns/${c.id}`)
          }
          className="w-full text-start"
        >
          <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-e2)]">
            <div className="shrink-0 rounded-xl bg-brand-50 p-2 text-brand-600">
              <Icon name="megaphone" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.name}</div>
            </div>
            <CampaignStatusBadge status={c.status} />
            <Icon
              name="chevron-end"
              size={16}
              className="shrink-0 text-neutral-300"
            />
          </Card>
        </button>
      ))}
    </div>
  );
}

function CampaignStatusBadge({ status }: { status: Campaign["status"] }) {
  const map = {
    building: { text: "בהקמה", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    active: { text: "פעיל", cls: "bg-teal-50 text-teal-700 ring-teal-200" },
    done: { text: "הסתיים", cls: "bg-navy-50 text-navy-500 ring-navy-200" },
  }[status];
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${map.cls}`}
    >
      {map.text}
    </span>
  );
}

/* ------------------------------ Reports tab ------------------------------- */

function ReportsTab({
  businessId,
  onError,
}: {
  businessId: string;
  onError: (msg: string | null) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const briefs = useQuery({
    queryKey: ["briefs", businessId],
    queryFn: () => briefsApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const strategies = useQuery({
    queryKey: ["strategies", businessId],
    queryFn: () => strategiesApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const plans = useQuery({
    queryKey: ["plans", businessId],
    queryFn: () => plansApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const removeBrief = useMutation({
    mutationFn: (id: string) => briefsApi.remove(businessId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefs", businessId] }),
    onError: (err) => onError(apiErrorMessage(err, "מחיקת הבריף נכשלה")),
  });
  const removeStrategy = useMutation({
    mutationFn: (id: string) => strategiesApi.remove(businessId, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["strategies", businessId] }),
    onError: (err) => onError(apiErrorMessage(err, "מחיקת האסטרטגיה נכשלה")),
  });
  const removePlan = useMutation({
    mutationFn: (id: string) => plansApi.remove(businessId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans", businessId] }),
    onError: (err) => onError(apiErrorMessage(err, "מחיקת התוכנית נכשלה")),
  });

  const briefList = briefs.data ?? [];
  const strategyList = strategies.data ?? [];
  const planList = plans.data ?? [];

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {/* Briefs column */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-navy-500">בריפים</h2>
        {briefList.length === 0 ? (
          <Card className="p-6 text-center text-sm text-neutral-400">
            עוד לא הופק בריף
          </Card>
        ) : (
          <div className="space-y-2.5">
            {briefList.map((brief) => (
              <BriefRow
                key={brief.id}
                brief={brief}
                businessId={businessId}
                onDelete={() => {
                  if (confirm("למחוק את הבריף?")) removeBrief.mutate(brief.id);
                }}
                deleting={
                  removeBrief.isPending && removeBrief.variables === brief.id
                }
                onStrategyGenerated={(strategy) => {
                  void qc.invalidateQueries({
                    queryKey: ["strategies", businessId],
                  });
                  navigate(
                    `/app/businesses/${businessId}/strategies/${strategy.id}`,
                  );
                }}
                onError={onError}
              />
            ))}
          </div>
        )}
      </section>

      {/* Strategies column */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-navy-500">אסטרטגיות</h2>
        {strategyList.length === 0 ? (
          <Card className="p-6 text-center text-sm text-neutral-400">
            עוד לא הופקה אסטרטגיה
          </Card>
        ) : (
          <div className="space-y-2.5">
            {strategyList.map((strategy) => (
              <StrategyRow
                key={strategy.id}
                strategy={strategy}
                businessId={businessId}
                onDelete={() => {
                  if (confirm("למחוק את האסטרטגיה?"))
                    removeStrategy.mutate(strategy.id);
                }}
                deleting={
                  removeStrategy.isPending &&
                  removeStrategy.variables === strategy.id
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Plans column */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-navy-500">
          תוכניות עבודה
        </h2>
        {planList.length === 0 ? (
          <Card className="p-6 text-center text-sm text-neutral-400">
            עוד לא הופקה תוכנית
          </Card>
        ) : (
          <div className="space-y-2.5">
            {planList.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                businessId={businessId}
                onDelete={() => {
                  if (confirm("למחוק את התוכנית?")) removePlan.mutate(plan.id);
                }}
                deleting={
                  removePlan.isPending && removePlan.variables === plan.id
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PlanRow({
  plan,
  businessId,
  onDelete,
  deleting,
}: {
  plan: Plan;
  businessId: string;
  onDelete: () => void;
  deleting: boolean;
}) {
  const approved = plan.status === "approved";
  return (
    <Card className="flex items-center justify-between gap-3 p-3.5">
      <Link
        to={`/app/businesses/${businessId}/plans/${plan.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
            approved
              ? "bg-teal-50 text-teal-700 ring-teal-200"
              : "bg-coral-50 text-coral-600 ring-coral-200"
          }`}
        >
          {approved ? "מאושרת" : "טיוטה"}
        </span>
        <span className="truncate text-sm font-medium text-navy-900">
          {plan.title}
        </span>
        {plan.edited && (
          <span className="shrink-0 text-xs text-navy-400">נערך ידנית</span>
        )}
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          icon="trash"
          disabled={deleting}
          onClick={onDelete}
        >
          מחיקה
        </Button>
        <Icon name="chevron-start" size={18} className="text-navy-300" />
      </div>
    </Card>
  );
}

function BriefRow({
  brief,
  businessId,
  onDelete,
  deleting,
  onStrategyGenerated,
  onError,
}: {
  brief: Brief;
  businessId: string;
  onDelete: () => void;
  deleting: boolean;
  onStrategyGenerated: (strategy: Strategy) => void;
  onError: (msg: string | null) => void;
}) {
  const approved = brief.status === "approved";

  const generateStrategy = useMutation({
    mutationFn: () => strategiesApi.generate(businessId, brief.id),
    onSuccess: onStrategyGenerated,
    onError: (err) =>
      onError(apiErrorMessage(err, "הפקת האסטרטגיה נכשלה — נסה שוב")),
  });

  return (
    <Card className="p-3.5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/app/businesses/${businessId}/briefs/${brief.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
              approved
                ? "bg-teal-50 text-teal-700 ring-teal-200"
                : "bg-coral-50 text-coral-600 ring-coral-200"
            }`}
          >
            {approved ? "מאושר" : "טיוטה"}
          </span>
          <span className="truncate text-sm font-medium text-navy-900">
            {brief.title}
          </span>
          {brief.edited && (
            <span className="shrink-0 text-xs text-navy-400">נערך ידנית</span>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <span
            title={approved ? undefined : "יש לאשר את הבריף קודם"}
            className="inline-flex"
          >
            <Button
              size="sm"
              variant={approved ? "secondary" : "ghost"}
              icon="megaphone"
              disabled={!approved || generateStrategy.isPending}
              onClick={() => {
                onError(null);
                generateStrategy.mutate();
              }}
            >
              {generateStrategy.isPending ? "מפיק…" : "הפק אסטרטגיה"}
            </Button>
          </span>
          <Button
            size="sm"
            variant="ghost"
            icon="trash"
            disabled={deleting}
            onClick={onDelete}
          >
            מחיקה
          </Button>
          <Icon name="chevron-start" size={18} className="text-navy-300" />
        </div>
      </div>

      {generateStrategy.isPending && (
        <p className="mt-2.5 border-t border-navy-100 pt-2.5 text-xs text-navy-400">
          בונה אסטרטגיה מהבריף — הניסוח המלא אורך 2–3 דקות. אפשר להמתין כאן, לא
          לרענן את הדף.
        </p>
      )}
    </Card>
  );
}

function StrategyRow({
  strategy,
  businessId,
  onDelete,
  deleting,
}: {
  strategy: Strategy;
  businessId: string;
  onDelete: () => void;
  deleting: boolean;
}) {
  const approved = strategy.status === "approved";
  return (
    <Card className="flex items-center justify-between gap-3 p-3.5">
      <Link
        to={`/app/businesses/${businessId}/strategies/${strategy.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
            approved
              ? "bg-teal-50 text-teal-700 ring-teal-200"
              : "bg-coral-50 text-coral-600 ring-coral-200"
          }`}
        >
          {approved ? "מאושרת" : "טיוטה"}
        </span>
        <span className="truncate text-sm font-medium text-navy-900">
          {strategy.title}
        </span>
        {strategy.edited && (
          <span className="shrink-0 text-xs text-navy-400">נערך ידנית</span>
        )}
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          icon="trash"
          disabled={deleting}
          onClick={onDelete}
        >
          מחיקה
        </Button>
        <Icon name="chevron-start" size={18} className="text-navy-300" />
      </div>
    </Card>
  );
}

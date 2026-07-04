import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { leadsApi } from "../../api/leads";
import { tasksApi } from "../../api/tasks";
import { conversationsApi } from "../../api/conversations";
import { billingApi } from "../../api/billing";
import { Card, Spinner } from "../../components/ui";

const PLAN_ORDER = ["free", "growth", "scale"];

function tint(varName: string, pct = 14): CSSProperties {
  return { backgroundColor: `color-mix(in srgb, var(${varName}) ${pct}%, white)` };
}

function shekels(cents: number): string {
  return `₪${Math.round(cents / 100).toLocaleString("he-IL")}`;
}

export default function Growth() {
  const { businessId = "" } = useParams<{ businessId: string }>();

  const leads = useQuery({
    queryKey: ["leads", businessId],
    queryFn: () => leadsApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const tasks = useQuery({
    queryKey: ["tasks", businessId],
    queryFn: () => tasksApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const convos = useQuery({
    queryKey: ["conversations", businessId, "growth"],
    queryFn: () => conversationsApi.list(businessId, { limit: 200 }),
    enabled: Boolean(businessId),
  });
  const sub = useQuery({
    queryKey: ["billing", "subscription", businessId],
    queryFn: () => billingApi.subscription(businessId),
    enabled: Boolean(businessId),
  });
  const plansQ = useQuery({
    queryKey: ["billing", "plans", businessId],
    queryFn: () => billingApi.plans(businessId),
    enabled: Boolean(businessId),
  });

  const leadCount = (leads.data ?? []).length;
  const convoCount = (convos.data ?? []).length;
  const allTasks = tasks.data ?? [];
  const doneCount = allTasks.filter((t) => t.status === "done").length;
  const totalTasks = allTasks.length;
  const efficiency =
    totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  const plans = plansQ.data?.plans ?? [];
  const currentCode = sub.data?.planCode ?? "free";
  const currentPlan = plans.find((p) => p.code === currentCode);
  const currentIdx = PLAN_ORDER.indexOf(currentCode);
  const nextCode = currentIdx >= 0 ? PLAN_ORDER[currentIdx + 1] : undefined;
  const nextPlan = nextCode ? plans.find((p) => p.code === nextCode) : undefined;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display text-navy-900">
            הצמיחה שלך
          </h1>
          <p className="text-navy-500 mt-1">
            תמונת מצב של העסק — וכיצד להאיץ קדימה.
          </p>
        </div>
        {currentPlan && (
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-navy-700"
            style={tint("--brand-secondary", 18)}
          >
            תוכנית: {currentPlan.name}
          </span>
        )}
      </header>

      {/* Three axes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Metric
          label="צמיחה"
          icon="📈"
          brand="--brand-primary"
          value={leadCount}
          sub="לידים שנאספו"
          loading={leads.isLoading}
        />
        <Metric
          label="יעילות"
          icon="⚡"
          brand="--brand-accent"
          value={`${efficiency}%`}
          sub={`${doneCount} מתוך ${totalTasks} משימות הושלמו`}
          loading={tasks.isLoading}
        />
        <Metric
          label="טווח"
          icon="🌐"
          brand="--brand-secondary"
          value={convoCount}
          sub="לקוחות ששוחחו איתך"
          loading={convos.isLoading}
        />
      </div>

      {/* Upgrade */}
      <h2 className="text-sm font-semibold text-navy-700 mb-3">
        להאיץ את הצמיחה
      </h2>
      {plansQ.isLoading || sub.isLoading ? (
        <Card className="p-8 flex justify-center">
          <Spinner />
        </Card>
      ) : nextPlan ? (
        <Card
          className="p-6 text-white overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-white/60 mb-1">
                שדרג לתוכנית {nextPlan.name}
              </div>
              <div className="text-2xl font-display">
                {shekels(nextPlan.priceCents)}
                <span className="text-sm text-white/60"> / חודש</span>
              </div>
            </div>
            <Link
              to={`/app/businesses/${businessId}/billing`}
              className="inline-flex items-center justify-center rounded-xl bg-white/95 px-5 py-2.5 text-sm font-semibold text-navy-900 hover:bg-white transition-colors shrink-0"
            >
              שדרג עכשיו
            </Link>
          </div>
          <ul className="mt-4 pt-4 border-t border-white/15 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {nextPlan.features.map((f) => (
              <li key={f} className="text-sm text-white/85 flex items-start gap-2">
                <span className="text-white/60 mt-0.5">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <div className="text-2xl mb-2">🚀</div>
          <div className="font-semibold text-navy-900">
            אתה בתוכנית הגבוהה ביותר
          </div>
          <p className="text-sm text-navy-500 mt-1">
            כל היכולות פתוחות עבורך. קדימה לצמוח!
          </p>
        </Card>
      )}
    </div>
  );
}

function Metric({
  label,
  icon,
  brand,
  value,
  sub,
  loading,
}: {
  label: string;
  icon: string;
  brand: string;
  value: number | string;
  sub: string;
  loading: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-navy-400 mb-1">{label}</div>
          <div className="text-3xl font-bold text-navy-900">
            {loading ? "—" : value}
          </div>
          <div className="text-[11px] text-navy-400 mt-1">{sub}</div>
        </div>
        <div
          className="h-11 w-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
          style={tint(brand, 14)}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

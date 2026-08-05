import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { leadsApi } from "../../api/leads";
import { tasksApi } from "../../api/tasks";
import { conversationsApi } from "../../api/conversations";
import { billingApi } from "../../api/billing";
import { billingKeys } from "../../lib/queryKeys";
import { Badge, Card, PageHeader, Spinner, StatCard } from "../../components/ui";
import { Icon } from "../../components/icons";

const LOAD_ERROR = "לא ניתן לטעון נתונים כרגע";

const PLAN_ORDER = ["free", "growth", "scale"];

/**
 * A single motivational "next move" that scales with the business's monthly
 * revenue: small/starting businesses get short, concrete, do-it-now actions;
 * as revenue grows the ambition escalates toward bolder, ceiling-breaking
 * moves — always oriented to using the system + Portal Studio's help.
 * Thresholds are monthly income in agorot (₪ × 100).
 */
interface MoveTier {
  maxCents: number;
  title: string;
  line: string;
  ctaLabel: string;
  ctaPath: string;
}
const MOVE_TIERS: MoveTier[] = [
  {
    maxCents: 1,
    title: "המהלך הראשון שלך",
    line: "כל עסק גדול התחיל מפעולה אחת קטנה. הגדר היום יעד אחד קצר — ואני אזכיר לך עליו. שתי דקות, ואתה בתנועה.",
    ctaLabel: "להגדיר תזכורת",
    ctaPath: "/app/businesses/{id}/agents/reminders",
  },
  {
    maxCents: 500000,
    title: "המהלך הבא שלך",
    line: "יש לך תנועה — עכשיו נהפוך אותה לקצב. בחר פעולה קטנה אחת לשבוע, והמערכת תדאג שתקרה בזמן.",
    ctaLabel: "לפתוח משימות",
    ctaPath: "/app/businesses/{id}/tasks",
  },
  {
    maxCents: 3000000,
    title: "אתה בצמיחה — כדאי להאיץ",
    line: "צמיחה אמיתית מבקשת מהלך גדול יותר. תן לסוכנים להפיק לך תוכן ומסמכים ולפנות לך זמן לגדול — במקום לרדוף אחרי הפרטים.",
    ctaLabel: "לצוות הסוכנים",
    ctaPath: "/app/businesses/{id}/agents",
  },
  {
    maxCents: Number.MAX_SAFE_INTEGER,
    title: "זה הזמן לנפץ תקרות",
    line: "אתה מגלגל ברצינות — עכשיו לוקחים סיכון מחושב. בוא נבנה מהלך נועז יחד; Portal Studio כאן כדי להפוך רעיון שאפתני לתוצאה.",
    ctaLabel: "לתכנן מהלך עם הסוכן הראשי",
    ctaPath: "/app/businesses/{id}/agents/main",
  },
];

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
    queryKey: billingKeys.subscription(businessId),
    queryFn: () => billingApi.subscription(businessId),
    enabled: Boolean(businessId),
  });
  const plansQ = useQuery({
    queryKey: billingKeys.plans(businessId),
    queryFn: () => billingApi.plans(businessId),
    enabled: Boolean(businessId),
  });
  const invoices = useQuery({
    queryKey: billingKeys.invoices(businessId),
    queryFn: () => billingApi.invoices(businessId),
    enabled: Boolean(businessId),
  });

  // Monthly revenue (paid invoices this month) drives the scaled "next move".
  const monthIncome = useMemo(() => {
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
  const move =
    MOVE_TIERS.find((t) => monthIncome < t.maxCents) ??
    MOVE_TIERS[MOVE_TIERS.length - 1];

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
    <div className="px-4 sm:px-6 md:px-8 py-6 md:py-8 max-w-4xl mx-auto">
      <PageHeader
        title="הצמיחה שלך"
        subtitle="תמונת מצב של העסק — וכיצד להאיץ קדימה."
        action={
          currentPlan ? (
            <Badge tone="brand">תוכנית: {currentPlan.name}</Badge>
          ) : undefined
        }
      />

      {/* Three axes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="צמיחה"
          icon="growth"
          tone="brand"
          value={leadCount}
          sub={leads.isError ? LOAD_ERROR : "לידים שנאספו"}
          error={leads.isLoading || leads.isError}
        />
        <StatCard
          label="יעילות"
          icon="bolt"
          tone="accent"
          value={`${efficiency}%`}
          sub={
            tasks.isError
              ? LOAD_ERROR
              : `${doneCount} מתוך ${totalTasks} משימות הושלמו`
          }
          error={tasks.isLoading || tasks.isError}
        />
        <StatCard
          label="טווח"
          icon="globe"
          tone="secondary"
          value={convoCount}
          sub={convos.isError ? LOAD_ERROR : "לקוחות ששוחחו איתך"}
          error={convos.isLoading || convos.isError}
        />
      </div>

      {/* Scaled motivational "next move" — grows bolder with revenue */}
      <Card
        className="p-6 mb-8 border-s-4"
        style={{ borderInlineStartColor: "var(--brand-accent)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-600">
              <Icon name="target" size={15} />
              {move.title}
            </div>
            <p className="text-navy-800 leading-relaxed max-w-2xl">
              {move.line}
            </p>
          </div>
          <Link
            to={move.ctaPath.replace("{id}", businessId)}
            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--brand-accent)" }}
          >
            {move.ctaLabel}
          </Link>
        </div>
      </Card>

      {/* Upgrade */}
      <h2 className="text-sm font-semibold text-navy-700 mb-3">
        להאיץ את הצמיחה
      </h2>
      {plansQ.isLoading || sub.isLoading ? (
        <Card className="p-8 flex justify-center">
          <Spinner />
        </Card>
      ) : plansQ.isError || sub.isError ? (
        <Card className="p-6 text-center text-navy-400 text-sm">
          לא ניתן לטעון נתונים כרגע. נסה שוב מאוחר יותר.
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
              to={`/app/businesses/${businessId}/subscription`}
              className="inline-flex items-center justify-center rounded-xl bg-white/95 px-5 py-2.5 text-sm font-semibold text-navy-900 hover:bg-white transition-colors shrink-0"
            >
              שדרג עכשיו
            </Link>
          </div>
          <ul className="mt-4 pt-4 border-t border-white/15 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {nextPlan.features.map((f) => (
              <li key={f} className="text-sm text-white/85 flex items-start gap-2">
                <Icon
                  name="check"
                  size={16}
                  className="mt-0.5 shrink-0 text-white/60"
                />
                {f}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-basil-100 text-basil-600">
            <Icon name="check-circle" size={24} />
          </div>
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


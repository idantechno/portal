import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { notificationsApi } from "../../api/notifications";
import { businessesApi } from "../../api/businesses";
import { billingApi } from "../../api/billing";
import { expensesApi } from "../../api/expenses";
import { overviewApi } from "../../api/overview";
import { useAuthStore } from "../../store/auth";
import { billingKeys } from "../../lib/queryKeys";
import { Button, Card, Spinner } from "../../components/ui";
import BusinessProfileForm from "../../components/BusinessProfileForm";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "בוקר טוב";
  if (h < 18) return "צהריים טובים";
  return "ערב טוב";
}

function tint(varName: string, pct = 14): CSSProperties {
  return { backgroundColor: `color-mix(in srgb, var(${varName}) ${pct}%, white)` };
}

function shekels(cents: number): string {
  return `₪${Math.round(cents / 100).toLocaleString("he-IL")}`;
}

export default function Home() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const user = useAuthStore((s) => s.user);

  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });
  const tasks = useQuery({
    queryKey: ["tasks", businessId],
    queryFn: () => tasksApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const notifs = useQuery({
    queryKey: ["notifications", businessId],
    queryFn: () => notificationsApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const invoices = useQuery({
    queryKey: billingKeys.invoices(businessId),
    queryFn: () => billingApi.invoices(businessId),
    enabled: Boolean(businessId),
  });
  const expenses = useQuery({
    queryKey: ["expenses", "summary", businessId],
    queryFn: () => expensesApi.summary(businessId),
    enabled: Boolean(businessId),
  });
  const overview = useQuery({
    queryKey: ["overview", businessId],
    queryFn: () => overviewApi.get(businessId),
    enabled: Boolean(businessId),
    staleTime: 1000 * 60 * 30,
  });

  const allTasks = useMemo(() => tasks.data ?? [], [tasks.data]);
  const weekEvents = useMemo(() => {
    const now = new Date().getTime();
    const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
    return allTasks
      .filter((t) => {
        if (!t.dueAt || t.status === "done") return false;
        const due = new Date(t.dueAt).getTime();
        return due >= now && due <= weekAhead;
      })
      .sort(
        (a, b) =>
          new Date(a.dueAt as string).getTime() -
          new Date(b.dueAt as string).getTime(),
      );
  }, [allTasks]);

  const paidInvoices = useMemo(
    () => (invoices.data ?? []).filter((i) => i.status === "paid"),
    [invoices.data],
  );
  const monthIncome = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return paidInvoices
      .filter((i) => {
        const d = i.paidAt ? new Date(i.paidAt) : null;
        return d && d.getFullYear() === y && d.getMonth() === m;
      })
      .reduce((sum, i) => sum + i.amountCents, 0);
  }, [paidInvoices]);

  // Money screens must not render a real-looking ₪0 when the finance data
  // failed to load. Guard the month-balance / deals cards on query errors.
  const invoicesError = invoices.isError;
  const balanceError = invoices.isError || expenses.isError;

  const recent = (notifs.data ?? []).slice(0, 5);
  const branding = biz.data?.branding ?? null;
  const firstName = user?.name ? user.name.split(" ")[0] : "";
  const [showProfile, setShowProfile] = useState(false);
  const needsOnboarding = Boolean(biz.data) && !biz.data?.onboarding?.completed;

  const ex = overview.data;

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 md:py-8 max-w-5xl mx-auto">
      {/* Greeting band */}
      <div className="rounded-3xl bg-white border border-navy-100 shadow-sm p-6 md:p-7 mb-6 flex items-center gap-5">
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            className="h-14 w-14 rounded-2xl object-contain bg-cream-50 border border-navy-100 p-1 shrink-0"
          />
        ) : (
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={tint("--brand-accent", 16)}
          >
            👋
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-display text-navy-900">
            {greeting()}
            {firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-navy-500 mt-1 truncate">
            {branding?.slogan
              ? branding.slogan
              : biz.data?.name
                ? `הנה מה שקורה ב${biz.data.name}`
                : "מוקד הבקרה שלך"}
          </p>
        </div>
      </div>

      {/* First-run: get to know the business (feeds all agents) */}
      {needsOnboarding && biz.data && (
        <Card className="p-5 mb-6 border-brand-200 bg-brand-50/50">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-semibold text-navy-900">
                בוא נכיר את העסק שלך ✨
              </div>
              <p className="text-sm text-navy-500 mt-0.5">
                כמה שאלות קצרות — וכל הסוכנים יעבדו בול לפי העסק שלך.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowProfile((v) => !v)}>
              {showProfile ? "סגור" : "בוא נתחיל"}
            </Button>
          </div>
          {showProfile && (
            <div className="mt-5 pt-5 border-t border-brand-100">
              <BusinessProfileForm
                businessId={businessId}
                business={biz.data}
                onSaved={() => setShowProfile(false)}
              />
            </div>
          )}
        </Card>
      )}

      {/* Snapshot: deals / income / week's events */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat
          label="עסקאות שנסגרו"
          sub="חשבוניות ששולמו"
          value={paidInvoices.length}
          icon="🤝"
          brand="--brand-primary"
          to={`/app/businesses/${businessId}/billing`}
          error={invoicesError}
        />
        <Stat
          label="מאזן החודש"
          sub={
            balanceError
              ? "לא ניתן לטעון נתונים כרגע"
              : `הכנסות ${shekels(monthIncome)} · הוצאות ${shekels(
                  expenses.data?.monthlyTotalCents ?? 0,
                )}`
          }
          value={shekels(monthIncome - (expenses.data?.monthlyTotalCents ?? 0))}
          icon="💰"
          brand="--brand-secondary"
          to={`/app/businesses/${businessId}/expenses`}
          error={balanceError}
        />
        <Stat
          label="אירועי השבוע"
          sub="7 הימים הקרובים"
          value={weekEvents.length}
          icon="🗓️"
          brand="--brand-accent"
          to={`/app/businesses/${businessId}/calendar`}
        />
      </div>

      {/* Daily trio: AI tip + weather */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2 p-5">
          <div className="text-xs font-semibold text-brand-600 mb-1">
            💡 הטיפ היומי שלך
          </div>
          {overview.isLoading ? (
            <div className="flex items-center gap-2 text-navy-400 text-sm py-2">
              <Spinner /> מכין לך טיפ...
            </div>
          ) : ex?.tip ? (
            <p className="text-navy-800 leading-relaxed">{ex.tip}</p>
          ) : (
            <p className="text-navy-400 text-sm">
              הטיפ היומי ייטען כאן. מלא את אפיון העסק כדי שיהיה מדויק יותר.
            </p>
          )}
        </Card>

        <Card className="p-5 flex flex-col justify-center">
          {overview.isLoading ? (
            <div className="flex items-center gap-2 text-navy-400 text-sm">
              <Spinner /> מזג אוויר...
            </div>
          ) : ex?.weather ? (
            <div className="flex items-center gap-4">
              <div className="text-4xl">{ex.weather.emoji}</div>
              <div>
                <div className="text-2xl font-bold text-navy-900">
                  {ex.weather.tempC}°
                </div>
                <div className="text-xs text-navy-500">
                  {ex.weather.description} · {ex.weather.city}
                </div>
                <div className="text-[11px] text-navy-400 mt-0.5">
                  {ex.weather.hi}° / {ex.weather.lo}°
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-navy-400">
              מזג אוויר — הוסף עיר באפיון העסק.
            </div>
          )}
        </Card>
      </div>

      {/* News from the field */}
      {ex?.news && (
        <a
          href={ex.news.link}
          target="_blank"
          rel="noreferrer"
          className="block mb-6"
        >
          <Card className="p-4 hover:border-brand-200 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-lg shrink-0">📰</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-navy-900 truncate">
                  {ex.news.title}
                </div>
                {ex.news.source && (
                  <div className="text-[11px] text-navy-400">
                    {ex.news.source} · חדשה מהתחום שלך
                  </div>
                )}
              </div>
            </div>
          </Card>
        </a>
      )}

      {/* Week's events + AI assistant */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-navy-700 mb-3">
            השבוע הקרוב
          </h2>
          {weekEvents.length === 0 ? (
            <Card className="p-6 text-center text-navy-400 text-sm">
              אין אירועים בשבוע הקרוב.
            </Card>
          ) : (
            <Card className="divide-y divide-navy-50">
              {weekEvents.slice(0, 6).map((t) => (
                <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="text-xs text-navy-500 tabular-nums w-16 shrink-0"
                    dir="ltr"
                  >
                    {new Date(t.dueAt as string).toLocaleDateString("he-IL", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </div>
                  <div className="flex-1 min-w-0 text-sm text-navy-800 truncate">
                    {t.title}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-navy-700 mb-3">
            העוזר החכם
          </h2>
          <div
            className="rounded-3xl p-6 text-white shadow-sm h-[calc(100%-2rem)] flex flex-col"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
            }}
          >
            <div className="text-3xl mb-2">✨</div>
            <div className="text-lg font-display leading-snug">
              איך אפשר לעזור לך היום?
            </div>
            <p className="text-white/70 text-sm mt-2 flex-1">
              שאל אותי כל דבר על העסק — אני אנתב אותך לסוכן הנכון.
            </p>
            <Link
              to={`/app/businesses/${businessId}/agents/main`}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-white/95 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-white transition-colors"
            >
              שאל אותי כל דבר
            </Link>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      {recent.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-navy-700 mb-3 mt-2">
            פעילות אחרונה
          </h2>
          <Card className="divide-y divide-navy-50">
            {recent.map((n) => (
              <div key={n.id} className="px-4 py-3 flex items-start gap-3">
                <span
                  className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: "var(--brand-accent)" }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-navy-900">
                    {n.title}
                  </div>
                  {n.body && (
                    <div className="text-xs text-navy-400 mt-0.5">{n.body}</div>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  sub,
  value,
  icon,
  brand,
  to,
  error = false,
}: {
  label: string;
  sub: string;
  value: number | string;
  icon: string;
  brand: string;
  to: string;
  error?: boolean;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="p-5 h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(1,20,39,0.4)]">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-xs text-navy-400 mb-1">{label}</div>
            <div className="text-2xl font-bold text-navy-900 truncate">
              {error ? "—" : value}
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
    </Link>
  );
}

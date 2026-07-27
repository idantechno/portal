import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { appointmentsApi } from "../../api/appointments";
import { calendarApi } from "../../api/calendar";
import { notificationsApi } from "../../api/notifications";
import { businessesApi } from "../../api/businesses";
import { billingApi } from "../../api/billing";
import { expensesApi } from "../../api/expenses";
import { overviewApi } from "../../api/overview";
import { useAuthStore } from "../../store/auth";
import { billingKeys } from "../../lib/queryKeys";
import {
  Button,
  Card,
  EmptyState,
  IconTile,
  SectionTitle,
  Spinner,
} from "../../components/ui";
import { Icon, ServerIcon } from "../../components/icons";
import type { IconName } from "../../components/icons";
import BusinessProfileForm from "../../components/BusinessProfileForm";
import WhatsappStatusBanner from "../../components/WhatsappStatusBanner";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "בוקר טוב";
  if (h < 18) return "צהריים טובים";
  return "ערב טוב";
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
  // Range for the "coming week" brief. Computed once per mount so the query
  // keys stay stable across re-renders.
  const weekRange = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { fromISO: from.toISOString(), toISO: to.toISOString() };
  }, []);
  const appointments = useQuery({
    queryKey: ["appointments", businessId, "week"],
    queryFn: () =>
      appointmentsApi.list(businessId, {
        from: weekRange.fromISO,
        to: weekRange.toISO,
        status: "scheduled",
      }),
    enabled: Boolean(businessId),
  });
  const calStatus = useQuery({
    queryKey: ["calendar", "status", businessId],
    queryFn: () => calendarApi.status(businessId),
    enabled: Boolean(businessId),
  });
  const googleConnected = calStatus.data?.connected ?? false;
  const googleEvents = useQuery({
    queryKey: ["calendar", "google", businessId, "week"],
    queryFn: () =>
      calendarApi.googleEvents(
        businessId,
        weekRange.fromISO,
        weekRange.toISO,
      ),
    enabled: Boolean(businessId) && googleConnected,
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
  // The weekly brief merges every dated source the calendar knows about:
  // system reminders (tasks with a due date), booked appointments, and Google
  // Calendar events. Reading tasks alone made the home brief say "השבוע פנוי"
  // while the calendar showed real entries.
  const weekEvents = useMemo(() => {
    const now = new Date().getTime();
    const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
    const out: { id: string; title: string; dateISO: string }[] = [];
    for (const t of allTasks) {
      if (!t.dueAt || t.status === "done") continue;
      const due = new Date(t.dueAt).getTime();
      if (due >= now && due <= weekAhead)
        out.push({ id: `t-${t.id}`, title: t.title, dateISO: t.dueAt });
    }
    for (const a of appointments.data ?? []) {
      const start = new Date(a.startAt).getTime();
      if (start >= now && start <= weekAhead)
        out.push({ id: `a-${a.id}`, title: a.title, dateISO: a.startAt });
    }
    for (const e of googleEvents.data ?? []) {
      const start = new Date(e.start).getTime();
      if (start >= now && start <= weekAhead)
        out.push({ id: `g-${e.id}`, title: e.title, dateISO: e.start });
    }
    return out.sort(
      (a, b) =>
        new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime(),
    );
  }, [allTasks, appointments.data, googleEvents.data]);

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
        {/* Business logo — same source and fallback as the sidebar, so the
            greeting always shows a logo mark (the tenant's, or the Portal
            icon), never a bare initial. */}
        <img
          src={branding?.logoUrl || "/icon.png"}
          alt=""
          className="h-14 w-14 rounded-2xl object-contain bg-cream-50 border border-navy-100 p-1 shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-display text-navy-900">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
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

      {/* WhatsApp connection status — read-only reassurance for the owner. */}
      <WhatsappStatusBanner />

      {/* First-run: get to know the business (feeds all agents) */}
      {needsOnboarding && biz.data && (
        <Card className="p-5 mb-6 border-brand-200 bg-brand-50/50">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold text-navy-900">
                <Icon name="agents" size={17} className="text-brand-500" />
                בוא נכיר את העסק שלך
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
          icon="leads"
          tone="brand"
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
          icon="coins"
          tone="secondary"
          to={`/app/businesses/${businessId}/expenses`}
          error={balanceError}
        />
        <Stat
          label="אירועי השבוע"
          sub="7 הימים הקרובים"
          value={weekEvents.length}
          icon="calendar"
          tone="accent"
          to={`/app/businesses/${businessId}/calendar`}
        />
      </div>

      {/* Daily trio: AI tip + weather */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2 p-5">
          <div className="mb-2 flex items-center gap-2">
            <IconTile icon="idea" size="sm" tone="brand" />
            <div>
              <div className="eyebrow text-brand-500">היום</div>
              <div className="text-sm font-medium text-navy-800">
                הטיפ היומי שלך
              </div>
            </div>
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
              <ServerIcon
                name={ex.weather.icon}
                size={38}
                className="text-brand-400"
              />
              <div>
                <div className="tabular text-2xl font-bold text-navy-900">
                  {ex.weather.tempC}°
                </div>
                <div className="text-xs text-navy-500">
                  {ex.weather.description} · {ex.weather.city}
                </div>
                <div className="tabular text-[11px] text-navy-400 mt-0.5">
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
          <Card className="p-4 transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-brand)] hover:border-brand-200 hover:shadow-[var(--shadow-e2)]">
            <div className="flex items-center gap-3">
              <IconTile icon="news" size="sm" tone="neutral" />
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
              <Icon
                name="external"
                size={16}
                className="ms-auto shrink-0 text-navy-300"
              />
            </div>
          </Card>
        </a>
      )}

      {/* Week's events + AI assistant */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <SectionTitle eyebrow="יומן" title="השבוע הקרוב" />
          {weekEvents.length === 0 ? (
            <Card>
              <EmptyStateInline />
            </Card>
          ) : (
            <Card className="divide-y divide-navy-50">
              {weekEvents.slice(0, 6).map((t) => (
                <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="text-xs text-navy-500 tabular-nums w-16 shrink-0"
                    dir="ltr"
                  >
                    {new Date(t.dateISO).toLocaleDateString("he-IL", {
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
          <SectionTitle eyebrow="סוכן" title="העוזר החכם" />
          <div
            className="rounded-3xl p-6 text-white shadow-sm lg:h-[calc(100%-2rem)] flex flex-col"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
            }}
          >
            <Icon name="agents" size={30} className="mb-2 text-white/90" />
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
          <SectionTitle eyebrow="עדכונים" title="פעילות אחרונה" className="mt-2" />
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

function EmptyStateInline() {
  return (
    <EmptyState
      icon="calendar"
      title="השבוע פנוי"
      text="אין אירועים או משימות עם תאריך יעד בשבעת הימים הקרובים."
    />
  );
}

function Stat({
  label,
  sub,
  value,
  icon,
  tone,
  to,
  error = false,
}: {
  label: string;
  sub: string;
  value: number | string;
  icon: IconName;
  tone: "brand" | "secondary" | "accent";
  to: string;
  error?: boolean;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="h-full p-5 transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-brand)] group-hover:-translate-y-0.5 group-hover:border-navy-100 group-hover:shadow-[var(--shadow-e3)]">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-xs text-navy-400 mb-1">{label}</div>
            <div className="tabular truncate text-2xl font-bold text-navy-900">
              {error ? "—" : value}
            </div>
            <div className="text-[11px] text-navy-400 mt-1">{sub}</div>
          </div>
          <IconTile icon={icon} tone={tone} />
        </div>
      </Card>
    </Link>
  );
}

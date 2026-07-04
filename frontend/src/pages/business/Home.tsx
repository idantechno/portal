import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { leadsApi } from "../../api/leads";
import { notificationsApi } from "../../api/notifications";
import { businessesApi } from "../../api/businesses";
import { useAuthStore } from "../../store/auth";
import { Button, Card } from "../../components/ui";
import BusinessProfileForm from "../../components/BusinessProfileForm";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "בוקר טוב";
  if (h < 18) return "צהריים טובים";
  return "ערב טוב";
}

/** A soft tinted fill of a brand CSS variable, for stat icon circles. */
function tint(varName: string, pct = 14): CSSProperties {
  return { backgroundColor: `color-mix(in srgb, var(${varName}) ${pct}%, white)` };
}

export default function Home() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const user = useAuthStore((s) => s.user);
  const base = `/app/businesses/${businessId}`;

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
  const leads = useQuery({
    queryKey: ["leads", businessId],
    queryFn: () => leadsApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const notifs = useQuery({
    queryKey: ["notifications", businessId],
    queryFn: () => notificationsApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const allTasks = useMemo(() => tasks.data ?? [], [tasks.data]);
  const openTasks = allTasks.filter((t) => t.status !== "done").length;
  const leadCount = (leads.data ?? []).length;
  const weekEvents = useMemo(() => {
    const now = new Date().getTime();
    const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
    return allTasks.filter((t) => {
      if (!t.dueAt || t.status === "done") return false;
      const due = new Date(t.dueAt).getTime();
      return due >= now && due <= weekAhead;
    }).length;
  }, [allTasks]);
  const recent = (notifs.data ?? []).slice(0, 6);

  const branding = biz.data?.branding ?? null;
  const firstName = user?.name ? user.name.split(" ")[0] : "";
  const [showProfile, setShowProfile] = useState(false);
  const needsOnboarding = Boolean(biz.data) && !biz.data?.onboarding?.completed;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
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

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat
          label="משימות פתוחות"
          sub="ממתינות לטיפול"
          value={openTasks}
          icon="✅"
          brand="--brand-primary"
          to={`${base}/tasks`}
        />
        <Stat
          label="לידים"
          sub="פניות שנאספו"
          value={leadCount}
          icon="🤝"
          brand="--brand-secondary"
          to={`${base}/leads`}
        />
        <Stat
          label="אירועים השבוע"
          sub="7 הימים הקרובים"
          value={weekEvents}
          icon="🗓️"
          brand="--brand-accent"
          to={`${base}/calendar`}
        />
      </div>

      {/* Activity + AI assistant */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-navy-700 mb-3">
            פעילות אחרונה
          </h2>
          {recent.length === 0 ? (
            <Card className="p-8 text-center text-navy-400 text-sm">
              עדיין שקט. ברגע שיקרה משהו — ליד, הודעה או מסמך — זה יופיע כאן.
            </Card>
          ) : (
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
                      <div className="text-xs text-navy-400 mt-0.5">
                        {n.body}
                      </div>
                    )}
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
              שאל אותי כל דבר על העסק — אני אנתב אותך לסוכן הנכון ואטפל בבקשות.
            </p>
            <Link
              to="/app/agents/main"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-white/95 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-white transition-colors"
            >
              שאל אותי כל דבר
            </Link>
          </div>
        </div>
      </div>
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
}: {
  label: string;
  sub: string;
  value: number;
  icon: string;
  brand: string;
  to: string;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="p-5 h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(1,20,39,0.4)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-navy-400 mb-1">{label}</div>
            <div className="text-3xl font-bold text-navy-900">{value}</div>
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

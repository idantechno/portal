import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { leadsApi } from "../../api/leads";
import { notificationsApi } from "../../api/notifications";
import { businessesApi } from "../../api/businesses";
import { useAuthStore } from "../../store/auth";
import { Card } from "../../components/ui";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "בוקר טוב";
  if (h < 18) return "צהריים טובים";
  return "ערב טוב";
}

interface Tile {
  to: string;
  icon: string;
  title: string;
  desc: string;
  tone: string;
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

  const openTasks = (tasks.data ?? []).filter((t) => t.status !== "done").length;
  const leadCount = (leads.data ?? []).length;
  const recent = (notifs.data ?? []).slice(0, 5);

  const tiles: Tile[] = [
    {
      to: `${base}/inbox`,
      icon: "💬",
      title: "שיחות",
      desc: "תיבת שיחות מאוחדת",
      tone: "bg-brand-100 text-brand-700",
    },
    {
      to: `${base}/agents`,
      icon: "🤖",
      title: "צוות הסוכנים",
      desc: "הפק תוכן, תובנות ועוד",
      tone: "bg-teal-100 text-teal-700",
    },
    {
      to: `${base}/leads`,
      icon: "🤝",
      title: "לידים",
      desc: "פניות שנאספו",
      tone: "bg-coral-100 text-coral-700",
    },
    {
      to: `${base}/tasks`,
      icon: "✅",
      title: "משימות",
      desc: "מה צריך לעשות",
      tone: "bg-brand-100 text-brand-700",
    },
    {
      to: `${base}/automations`,
      icon: "⚡",
      title: "אוטומציות",
      desc: "כשקורה X — תעשה Y",
      tone: "bg-teal-100 text-teal-700",
    },
    {
      to: `${base}/billing`,
      icon: "🧾",
      title: "חיוב",
      desc: "מנוי וחשבוניות",
      tone: "bg-coral-100 text-coral-700",
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-display text-navy-900">
          {greeting()}
          {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-navy-500 mt-1">
          {biz.data?.name ? `הנה מה שקורה ב${biz.data.name}` : "מוקד הבקרה שלך"}
        </p>
      </header>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <Stat label="משימות פתוחות" value={openTasks} to={`${base}/tasks`} />
        <Stat label="לידים" value={leadCount} to={`${base}/leads`} />
        <Stat
          label="התראות"
          value={(notifs.data ?? []).filter((n) => !n.read).length}
          to={`${base}/inbox`}
        />
      </div>

      {/* Pillar quick-launch */}
      <h2 className="text-sm font-semibold text-brand-600 mb-3">קיצורי דרך</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {tiles.map((tile) => (
          <Link key={tile.to} to={tile.to} className="block group">
            <Card className="p-5 h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_40px_-22px_rgba(1,20,39,0.4)]">
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center text-2xl mb-3 ${tile.tone}`}
              >
                {tile.icon}
              </div>
              <div className="font-semibold text-navy-900">{tile.title}</div>
              <div className="text-sm text-navy-400">{tile.desc}</div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <h2 className="text-sm font-semibold text-brand-600 mb-3">פעילות אחרונה</h2>
      {recent.length === 0 ? (
        <Card className="p-8 text-center text-navy-400 text-sm">
          עדיין שקט. ברגע שיקרה משהו — ליד, הודעה או מסמך — זה יופיע כאן.
        </Card>
      ) : (
        <Card className="divide-y divide-navy-50">
          {recent.map((n) => (
            <div key={n.id} className="px-4 py-3">
              <div className="text-sm font-medium text-navy-900">{n.title}</div>
              {n.body && (
                <div className="text-xs text-navy-400 mt-0.5">{n.body}</div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  to,
}: {
  label: string;
  value: number;
  to: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-4 hover:border-brand-200 transition-colors">
        <div className="text-3xl font-bold text-navy-900">{value}</div>
        <div className="text-xs text-navy-400 mt-1">{label}</div>
      </Card>
    </Link>
  );
}

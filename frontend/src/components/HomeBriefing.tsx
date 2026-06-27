import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { conversationsApi } from "../api/conversations";
import { leadsApi } from "../api/leads";
import type { Lead } from "../api/leads";
import { Card } from "./ui";

// A calm daily briefing for the business owner: surfaces only the conversations
// the bot handed back ("waiting for you") and reassures that everything else is
// handled. The "waiting" signal is a conversation the agent escalated — status
// `human` with no assignee yet (see escalate_to_human in the agent worker).

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "home.greetingMorning";
  if (h < 18) return "home.greetingAfternoon";
  return "home.greetingEvening";
}

// Kept out of the component body so the impure `Date.now()` isn't called
// during render (the React Compiler lint forbids that).
function countRecentLeads(leads: Lead[] | undefined): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return (leads ?? []).filter(
    (l) => new Date(l.createdAt).getTime() >= weekAgo,
  ).length;
}

type Tone = "coral" | "brand" | "teal" | "calm";

const toneClasses: Record<Tone, { iconBox: string; value: string }> = {
  coral: { iconBox: "bg-coral-100 text-coral-600", value: "text-coral-700" },
  brand: { iconBox: "bg-brand-100 text-brand-700", value: "text-navy-900" },
  teal: { iconBox: "bg-teal-100 text-teal-700", value: "text-navy-900" },
  calm: { iconBox: "bg-teal-100 text-teal-600", value: "text-navy-900" },
};

function Tile({
  icon,
  value,
  label,
  sub,
  tone,
  to,
  loading,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  sub: string;
  tone: Tone;
  to?: string;
  loading?: boolean;
}) {
  const c = toneClasses[tone];
  const inner = (
    <Card
      className={`p-5 h-full ${
        to
          ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(1,20,39,0.4)]"
          : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`h-11 w-11 rounded-2xl flex items-center justify-center ${c.iconBox}`}
        >
          {icon}
        </div>
        {to && (
          <span className="text-brand-400 text-lg transition-transform group-hover:-translate-x-1 rtl:rotate-180">
            →
          </span>
        )}
      </div>
      <div className={`mt-4 text-3xl font-semibold tabular-nums ${c.value}`}>
        {loading ? (
          <span className="inline-block h-7 w-9 rounded-md bg-navy-100 animate-pulse align-middle" />
        ) : (
          value
        )}
      </div>
      <div className="mt-1 text-sm font-medium text-navy-900">{label}</div>
      <div className="mt-0.5 text-xs text-navy-400">{sub}</div>
    </Card>
  );
  return to ? (
    <Link to={to} className="block group">
      {inner}
    </Link>
  ) : (
    inner
  );
}

const svg = "w-5 h-5";
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className={svg} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className={svg} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className={svg} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);
const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className={svg} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export function HomeBriefing({
  businessId,
  name,
}: {
  businessId: string;
  name?: string;
}) {
  const { t } = useTranslation();

  const human = useQuery({
    queryKey: ["briefing", "human", businessId],
    queryFn: () => conversationsApi.list(businessId, { status: "human", limit: 100 }),
    staleTime: 15000,
  });
  const bot = useQuery({
    queryKey: ["briefing", "bot", businessId],
    queryFn: () => conversationsApi.list(businessId, { status: "bot", limit: 100 }),
    staleTime: 15000,
  });
  const leads = useQuery({
    queryKey: ["briefing", "leads", businessId],
    queryFn: () => leadsApi.list(businessId),
    staleTime: 15000,
  });

  const waitingForYou = (human.data ?? []).filter(
    (c) => !c.assignedAgentUserId,
  ).length;
  const activeCount = bot.data?.length ?? 0;
  const newLeads = countRecentLeads(leads.data);
  const loading = human.isLoading || bot.isLoading || leads.isLoading;

  const title =
    waitingForYou === 0
      ? t("home.allCalm")
      : waitingForYou === 1
        ? t("home.needsYouTitleOne")
        : t("home.needsYouTitle", { count: waitingForYou });
  const subtitle =
    waitingForYou === 0 ? t("home.nothingNeedsYou") : t("home.needsYouSub");

  const inbox = `/app/businesses/${businessId}/inbox`;
  const leadsHref = `/app/businesses/${businessId}/leads`;

  return (
    <section className="mb-10">
      <div className="mb-5">
        <div className="text-sm font-medium text-brand-600">
          {t(greetingKey())}
          {name ? `, ${name}` : ""}
        </div>
        <h1 className="mt-1.5 text-2xl sm:text-[1.7rem] font-semibold text-navy-900 leading-tight text-balance">
          {title}
        </h1>
        <p className="mt-1.5 max-w-xl text-navy-400 text-balance">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Tile
          tone={waitingForYou > 0 ? "coral" : "calm"}
          icon={waitingForYou > 0 ? <BellIcon /> : <CheckIcon />}
          value={waitingForYou}
          label={t("home.waitingLabel")}
          sub={waitingForYou > 0 ? t("home.waitingNeedsAction") : t("home.waitingAllHandled")}
          to={inbox}
          loading={loading}
        />
        <Tile
          tone="brand"
          icon={<ChatIcon />}
          value={activeCount}
          label={t("home.activeLabel")}
          sub={t("home.activeSub")}
          to={inbox}
          loading={loading}
        />
        <Tile
          tone="teal"
          icon={<PersonIcon />}
          value={newLeads}
          label={t("home.newLeadsLabel")}
          sub={t("home.leadsSub")}
          to={leadsHref}
          loading={loading}
        />
      </div>
    </section>
  );
}

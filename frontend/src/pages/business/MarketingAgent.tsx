import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { briefsApi, type Brief } from "../../api/briefs";
import { strategiesApi, type Strategy } from "../../api/strategies";
import { plansApi, type Plan } from "../../api/plans";
import { campaignsApi, type Campaign } from "../../api/campaigns";
import { leadsApi, type Lead } from "../../api/leads";
import { customersApi } from "../../api/customers";
import { apiErrorMessage } from "../../api/client";
import CustomersPanel from "../../components/CustomersPanel";
import {
  Button,
  Card,
  EmptyState,
  FormError,
  Input,
  Spinner,
} from "../../components/ui";
import { Icon, type IconName } from "../../components/icons";

type Tab = "leads" | "customers" | "campaigns" | "schedule" | "reports";

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: "leads", label: "לידים", icon: "leads" },
  { key: "customers", label: "לקוחות", icon: "users" },
  { key: "campaigns", label: "קמפיינים", icon: "megaphone" },
  { key: "schedule", label: 'לו"ז', icon: "calendar" },
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

  if (agents.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const entitled = (agents.data ?? []).some((a) => a.key === "marketing");
  if (!entitled) {
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
        <LeadsTab businessId={businessId} onError={setError} />
      )}
      {tab === "customers" && <CustomersPanel businessId={businessId} />}
      {tab === "campaigns" && <CampaignsTab businessId={businessId} />}
      {tab === "schedule" && <ScheduleTab businessId={businessId} />}
      {tab === "reports" && (
        <ReportsTab businessId={businessId} onError={setError} />
      )}
    </div>
  );
}

/* ------------------------------- Leads tab -------------------------------- */

function LeadsTab({
  businessId,
  onError,
}: {
  businessId: string;
  onError: (msg: string | null) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const leads = useQuery({
    queryKey: ["leads", businessId],
    queryFn: () => leadsApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const briefs = useQuery({
    queryKey: ["briefs", businessId],
    queryFn: () => briefsApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const briefByLead = new Map(
    (briefs.data ?? [])
      .filter((b) => b.leadId)
      .map((b) => [b.leadId as string, b]),
  );
  const questionnaireLeads = (leads.data ?? []).filter(
    (l) => l.source === "questionnaire",
  );

  return (
    <section>
      <p className="mb-3 text-sm text-navy-500">
        מליד אפשר להפיק בריף, או להמיר אותו ללקוח כדי להמשיך לאסטרטגיה ותוכנית.
      </p>
      {leads.isLoading ? (
        <div className="text-sm text-neutral-500">טוען לידים…</div>
      ) : questionnaireLeads.length === 0 ? (
        <Card>
          <EmptyState
            icon="leads"
            title="אין עדיין לידים משאלון"
            text="בריף מופק מליד שמילא את שאלון האסטרטגיה (/strategy). ברגע שיגיע כזה — הוא יופיע כאן."
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {questionnaireLeads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              businessId={businessId}
              existing={briefByLead.get(lead.id) ?? null}
              onGenerated={(brief) => {
                void qc.invalidateQueries({ queryKey: ["briefs", businessId] });
                navigate(`/app/businesses/${businessId}/briefs/${brief.id}`);
              }}
              onConverted={(customerId) => {
                void qc.invalidateQueries({
                  queryKey: ["customers", businessId],
                });
                navigate(
                  `/app/businesses/${businessId}/customers/${customerId}`,
                );
              }}
              onError={onError}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LeadRow({
  lead,
  businessId,
  existing,
  onGenerated,
  onConverted,
  onError,
}: {
  lead: Lead;
  businessId: string;
  existing: Brief | null;
  onGenerated: (brief: Brief) => void;
  onConverted: (customerId: string) => void;
  onError: (msg: string | null) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [website, setWebsite] = useState("");

  const generate = useMutation({
    mutationFn: () =>
      briefsApi.generate(businessId, lead.id, {
        websiteUrl: website.trim() || undefined,
      }),
    onSuccess: onGenerated,
    onError: (err) => onError(apiErrorMessage(err, "הפקת הבריף נכשלה — נסה שוב")),
  });

  const convert = useMutation({
    mutationFn: () => customersApi.createFromLead(businessId, lead.id),
    onSuccess: (customer) => onConverted(customer.id),
    onError: (err) => onError(apiErrorMessage(err, "ההמרה ללקוח נכשלה")),
  });

  return (
    <Card className="p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-navy-900">
            {lead.name}
          </div>
          <div className="truncate text-xs text-navy-400">{lead.interest}</div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {existing && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                navigate(`/app/businesses/${businessId}/briefs/${existing.id}`)
              }
            >
              פתיחת הבריף
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon="user"
            disabled={convert.isPending}
            onClick={() => {
              onError(null);
              convert.mutate();
            }}
          >
            {convert.isPending ? "ממיר…" : "המר ללקוח"}
          </Button>
          {!open ? (
            <Button
              size="sm"
              variant={existing ? "ghost" : "primary"}
              icon={existing ? "refresh" : "megaphone"}
              onClick={() => {
                onError(null);
                setOpen(true);
              }}
            >
              {existing ? "הפקה מחדש" : "הפק בריף"}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              ביטול
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-navy-100 pt-3">
          <p className="mb-2 text-xs text-navy-400">
            אפשר להוסיף כתובת אתר — ממנה נחלץ שירותים, מחירים, טון והמלצות. בלי
            אתר, השדות האלה יסומנו ⟨לא ידוע⟩.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="example.co.il (רשות)"
              dir="ltr"
              className="w-56"
              disabled={generate.isPending}
            />
            <Button
              size="sm"
              icon="agents"
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? "מפיק בריף…" : "הפק"}
            </Button>
          </div>
          {generate.isPending && (
            <p className="mt-2 text-xs text-navy-400">
              ההפקה כוללת סריקת אתר וניסוח — עד כדקה.
            </p>
          )}
        </div>
      )}
    </Card>
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

/* ----------------------------- Schedule tab ------------------------------- */

function ScheduleTab({ businessId }: { businessId: string }) {
  const navigate = useNavigate();
  const customers = useQuery({
    queryKey: ["customers", businessId, "next_activity"],
    queryFn: () => customersApi.list(businessId, "next_activity"),
    enabled: Boolean(businessId),
  });

  const upcoming = (customers.data ?? []).filter((c) => c.nextActivityAt);

  if (customers.isLoading) {
    return <div className="text-sm text-neutral-500">טוען…</div>;
  }

  if (upcoming.length === 0) {
    return (
      <Card className="p-10">
        <EmptyState
          icon="calendar"
          title="אין פעילויות מתוכננות"
          text="קבע 'פעילות קרובה' בכרטיס של לקוח והיא תופיע כאן, לפי סדר התאריכים."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {upcoming.map((c) => (
        <button
          key={c.id}
          onClick={() =>
            navigate(`/app/businesses/${businessId}/customers/${c.id}`)
          }
          className="w-full text-start"
        >
          <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-e2)]">
            <div className="shrink-0 rounded-xl bg-amber-50 p-2 text-amber-700">
              <Icon name="clock" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {c.businessName?.trim() || c.name}
              </div>
              <div className="truncate text-xs text-neutral-500">
                {c.nextActivityNote || "פעילות מתוכננת"}
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-amber-700">
              {new Date(c.nextActivityAt as string).toLocaleDateString("he-IL", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              })}
            </span>
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

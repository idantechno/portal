import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  campaignsApi,
  type Campaign,
  type CampaignStatus,
  type ScheduleHorizon,
  type ScheduleItem,
} from "../../api/campaigns";
import { customersApi } from "../../api/customers";
import { apiErrorMessage } from "../../api/client";
import { Button, Card, FormError, Spinner, Textarea } from "../../components/ui";
import { Icon, type IconName } from "../../components/icons";

const STATUS_LABEL: Record<CampaignStatus, { text: string; cls: string }> = {
  building: { text: "בהקמה", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  active: { text: "פעיל", cls: "bg-teal-50 text-teal-700 ring-teal-200" },
  done: { text: "הסתיים", cls: "bg-navy-50 text-navy-500 ring-navy-200" },
};

export default function CampaignDetail() {
  const { businessId = "", campaignId = "" } = useParams<{
    businessId: string;
    campaignId: string;
  }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const campaign = useQuery({
    queryKey: ["campaign", businessId, campaignId],
    queryFn: () => campaignsApi.get(businessId, campaignId),
    enabled: Boolean(businessId && campaignId),
  });

  const update = useMutation({
    mutationFn: (patch: { status?: CampaignStatus }) =>
      campaignsApi.update(businessId, campaignId, patch),
    onSuccess: (updated) => {
      qc.setQueryData(["campaign", businessId, campaignId], updated);
      void qc.invalidateQueries({ queryKey: ["campaigns", businessId] });
    },
    onError: (e) => setError(apiErrorMessage(e, "העדכון נכשל")),
  });

  const remove = useMutation({
    mutationFn: () => campaignsApi.remove(businessId, campaignId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaigns", businessId] });
      navigate(`/app/businesses/${businessId}/agents/marketing`);
    },
    onError: (e) => setError(apiErrorMessage(e, "המחיקה נכשלה")),
  });

  const customerId = campaign.data?.customerId;
  const prereqs = useQuery({
    queryKey: ["campaign-prereqs", businessId, customerId],
    queryFn: () => campaignsApi.prerequisites(businessId, customerId!),
    enabled: Boolean(businessId && customerId),
  });
  const customer = useQuery({
    queryKey: ["customer", businessId, customerId],
    queryFn: () => customersApi.get(businessId, customerId!),
    enabled: Boolean(businessId && customerId),
  });
  const customerName =
    customer.data?.businessName?.trim() ||
    customer.data?.name?.trim() ||
    "הלקוח";

  if (campaign.isLoading || !campaign.data) {
    return (
      <div className="grid place-items-center p-10">
        <Spinner />
      </div>
    );
  }

  const c = campaign.data;
  const status = STATUS_LABEL[c.status];
  const stageA = Boolean(c.marketingPlanId);
  const stageB = Boolean(c.productionPlan);
  // Activation (stage C) is gated on the full prerequisite list being met —
  // the backend enforces the same on the status→active transition.
  const prereqItems = prereqs.data?.items ?? [];
  const allMet = prereqs.data?.allMet ?? false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        to={`/app/businesses/${businessId}/agents/marketing`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-800"
      >
        <Icon name="arrow-start" size={16} />
        סוכן שיווק
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="mb-1 truncate text-2xl font-bold">{c.name}</h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${status.cls}`}
          >
            {status.text}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status === "building" && (
            <Button
              size="sm"
              variant="teal"
              icon="check-circle"
              disabled={!allMet || update.isPending}
              title={allMet ? undefined : "צריך שכל דרישות הקדם יסומנו ✓"}
              onClick={() => update.mutate({ status: "active" })}
            >
              הפעלת קמפיין
            </Button>
          )}
          {c.status === "active" && (
            <Button
              size="sm"
              variant="secondary"
              icon="check-circle"
              disabled={update.isPending}
              onClick={() => update.mutate({ status: "done" })}
            >
              סיום קמפיין
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon="trash"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm("למחוק את הקמפיין?")) remove.mutate();
            }}
          >
            מחיקה
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <FormError message={error} />
        </div>
      )}

      {/* The 3 build stages */}
      <div className="space-y-3">
        <StageCard
          n="א'"
          icon="tasks"
          title="תוכנית שיווק"
          done={stageA}
          body={
            stageA ? (
              <Link
                to={`/app/businesses/${businessId}/plans/${c.marketingPlanId}`}
                className="text-sm text-brand-600 hover:underline"
              >
                פתיחת תוכנית העבודה המקושרת
              </Link>
            ) : (
              <span className="text-sm text-navy-400">
                אין תוכנית מקושרת.
              </span>
            )
          }
        />
        <StageCard
          n="ב'"
          icon="doc"
          title="תוכנית הפקה"
          done={stageB}
          body={
            <StageBProduction
              businessId={businessId}
              campaign={c}
              customerName={customerName}
            />
          }
        />
        <StageCard
          n="ג'"
          icon="calendar"
          title="לו״ז"
          done={Boolean(c.schedule?.length)}
          body={<StageCSchedule businessId={businessId} campaign={c} />}
        />
      </div>

      {/* Readiness — the full prerequisite list gates activation (stage C) */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-navy-500">
          מוכנות להפעלה
        </h2>
        <Card className="p-4">
          <p className="mb-2.5 text-xs text-navy-400">
            להפעלת הקמפיין צריך שכל דרישות הקדם יסומנו ✓:
          </p>
          <ul className="space-y-1.5">
            {prereqItems.map((it) => (
              <li key={it.key} className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                    it.met
                      ? "bg-teal-100 text-teal-700"
                      : "bg-coral-100 text-coral-600"
                  }`}
                >
                  {it.met ? "✓" : "!"}
                </span>
                <span className={it.met ? "text-navy-700" : "text-navy-500"}>
                  {it.label}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Status dashboard — built once the campaign runs */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-navy-500">מצב הקמפיין</h2>
        <Card className="p-6 text-center">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-50 text-navy-400">
            <Icon name="chart" size={22} />
          </div>
          <p className="text-sm text-navy-500">
            מעקב התקדמות מול הלו״ז, לידים שנקלטו, כמה הפכו ללקוחות ומסקנות —
            יוצג כאן ברגע שהקמפיין פעיל.
          </p>
          <p className="mt-1 text-xs text-navy-300">(בבנייה)</p>
        </Card>
      </section>
    </div>
  );
}

const HORIZONS: { key: ScheduleHorizon; label: string }[] = [
  { key: "monthly", label: "חודשי" },
  { key: "half_year", label: "חצי שנה" },
  { key: "yearly", label: "שנה" },
];

function dtToInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}
function inputToIso(v: string): string {
  return new Date(v).toISOString();
}
function sameDay(iso: string, y: number, m: number, d: number): boolean {
  const dt = new Date(iso);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StageCSchedule({
  businessId,
  campaign,
}: {
  businessId: string;
  campaign: Campaign;
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState<ScheduleItem[]>(campaign.schedule ?? []);
  const [horizon, setHorizon] = useState<ScheduleHorizon>(
    campaign.scheduleHorizon ?? "monthly",
  );
  const [view, setView] = useState<"list" | "calendar">("list");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const firstAt = campaign.schedule?.[0]?.at;
  const [cursor, setCursor] = useState(() => {
    const base = firstAt ? new Date(firstAt) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const setCampaign = (u: Campaign) =>
    qc.setQueryData(["campaign", businessId, campaign.id], u);

  const build = useMutation({
    mutationFn: () => campaignsApi.buildSchedule(businessId, campaign.id, horizon),
    onSuccess: (u) => {
      setCampaign(u);
      setItems(u.schedule ?? []);
      setError(null);
    },
    onError: (e) => setError(apiErrorMessage(e, "בניית הלו״ז נכשלה")),
  });

  const save = useMutation({
    mutationFn: () =>
      campaignsApi.saveSchedule(businessId, campaign.id, { horizon, items }),
    onSuccess: (u) => {
      setCampaign(u);
      setItems(u.schedule ?? []);
      void qc.invalidateQueries({ queryKey: ["campaigns", businessId] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 1500);
    },
    onError: (e) => setError(apiErrorMessage(e, "שמירת הלו״ז נכשלה")),
  });

  const hasProduction = Boolean(
    (campaign.productionPlan?.draft?.items ?? []).length,
  );
  const patch = (id: string, p: Partial<ScheduleItem>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const sorted = [...items].sort((a, b) => a.at.localeCompare(b.at));

  if (items.length === 0) {
    return (
      <div>
        {!hasProduction ? (
          <p className="text-sm text-navy-400">
            קודם צריך תוכנית הפקה (שלב ב׳). ממנה נבנה את הלו״ז.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-navy-500">אופק:</span>
            {HORIZONS.map((h) => (
              <button
                key={h.key}
                type="button"
                onClick={() => setHorizon(h.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  horizon === h.key
                    ? "bg-brand-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {h.label}
              </button>
            ))}
            <Button
              size="sm"
              icon="calendar"
              disabled={build.isPending}
              onClick={() => build.mutate()}
            >
              {build.isPending ? "בונה…" : "בנה לו״ז"}
            </Button>
          </div>
        )}
        {error && (
          <div className="mt-2">
            <FormError message={error} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-neutral-100 p-0.5">
          {(["list", "calendar"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                view === v ? "bg-white text-navy-900 shadow-sm" : "text-navy-500"
              }`}
            >
              {v === "list" ? "רשימה" : "יומן"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "שומר…" : saved ? "נשמר" : "שמירת לו״ז"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <FormError message={error} />
        </div>
      )}

      {view === "list" ? (
        <ol className="relative space-y-2 border-navy-100 ps-4">
          {sorted.map((it) => (
            <li key={it.id} className="relative">
              <span className="absolute -start-[19px] top-3 h-2 w-2 rounded-full bg-brand-500" />
              <div className="rounded-xl border border-navy-100 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                    {it.kind}
                  </span>
                  <span className="text-sm font-medium text-navy-900">
                    {it.title}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setItems((xs) => xs.filter((x) => x.id !== it.id))
                    }
                    className="ms-auto text-navy-300 hover:text-red-600"
                    aria-label="הסרה"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input
                    type="datetime-local"
                    value={dtToInput(it.at)}
                    onChange={(e) =>
                      patch(it.id, { at: inputToIso(e.target.value) })
                    }
                    dir="ltr"
                    className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={it.channel}
                    onChange={(e) => patch(it.id, { channel: e.target.value })}
                    placeholder="ערוץ"
                    className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={it.funding}
                    onChange={(e) => patch(it.id, { funding: e.target.value })}
                    placeholder="תקציב (אם ממומן)"
                    className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <ScheduleCalendar
          items={items}
          cursor={cursor}
          onPrev={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
          onNext={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
        />
      )}
    </div>
  );
}

function ScheduleCalendar({
  items,
  cursor,
  onPrev,
  onNext,
}: {
  items: ScheduleItem[];
  cursor: Date;
  onPrev: () => void;
  onNext: () => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric",
  });
  const dows = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-lg p-1 text-navy-500 hover:bg-navy-50"
          aria-label="חודש קודם"
        >
          <Icon name="chevron-start" size={18} />
        </button>
        <div className="text-sm font-semibold text-navy-800">{monthLabel}</div>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg p-1 text-navy-500 hover:bg-navy-50"
          aria-label="חודש הבא"
        >
          <Icon name="chevron-end" size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-navy-400">
        {dows.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const dayItems = d
            ? items.filter((it) => sameDay(it.at, year, month, d))
            : [];
          return (
            <div
              key={i}
              className={`min-h-16 rounded-lg border p-1 text-start ${
                d ? "border-navy-100" : "border-transparent"
              }`}
            >
              {d && (
                <div className="mb-0.5 text-[10px] text-navy-400">{d}</div>
              )}
              <div className="space-y-0.5">
                {dayItems.map((it) => (
                  <div
                    key={it.id}
                    className="truncate rounded bg-brand-50 px-1 py-0.5 text-[10px] text-brand-700"
                    title={`${it.title} · ${timeLabel(it.at)}${
                      it.channel ? " · " + it.channel : ""
                    }`}
                  >
                    {timeLabel(it.at)} {it.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageBProduction({
  businessId,
  campaign,
  customerName,
}: {
  businessId: string;
  campaign: Campaign;
  customerName: string;
}) {
  const qc = useQueryClient();
  const a = campaign.productionAnswers;
  const [style, setStyle] = useState(a?.style ?? "");
  const [firstScene, setFirstScene] = useState(a?.firstScene ?? "");
  const [clientPresence, setClientPresence] = useState(a?.clientPresence ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const answers = () => ({ style, firstScene, clientPresence });
  const setCampaign = (updated: Campaign) =>
    qc.setQueryData(["campaign", businessId, campaign.id], updated);

  const save = useMutation({
    mutationFn: () => campaignsApi.saveAnswers(businessId, campaign.id, answers()),
    onSuccess: (u) => {
      setCampaign(u);
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 1500);
    },
    onError: (e) => setError(apiErrorMessage(e, "שמירת התשובות נכשלה")),
  });

  const generate = useMutation({
    mutationFn: async () => {
      await campaignsApi.saveAnswers(businessId, campaign.id, answers());
      return campaignsApi.generateProduction(businessId, campaign.id);
    },
    onSuccess: (u) => {
      setCampaign(u);
      void qc.invalidateQueries({ queryKey: ["campaigns", businessId] });
      setError(null);
    },
    onError: (e) => setError(apiErrorMessage(e, "הפקת תוכנית ההפקה נכשלה")),
  });

  const allAnswered =
    style.trim() && firstScene.trim() && clientPresence.trim();
  const plan = campaign.productionPlan?.draft ?? null;

  const questions = [
    {
      label: "מה הסגנון הראשון שקפץ לך לראש לקמפיין? (אפשר גם שניים)",
      value: style,
      set: setStyle,
      placeholder: "במילים שלך — הכיוון היצירתי מתחיל כאן.",
    },
    {
      label: "התוכן הראשון שעולה לאוויר — איזו סצנה אתה מדמיין?",
      value: firstScene,
      set: setFirstScene,
      placeholder: "תאר את הפריים הראשון כפי שאתה רואה אותו.",
    },
    {
      label: `כמה לדעתך ${customerName} ירצה/יסכים לקחת חלק במדיה שעולה לרשתות?`,
      value: clientPresence,
      set: setClientPresence,
      placeholder: "לא / מעט / הרבה — וכל הקשר שחשוב.",
    },
  ];

  return (
    <div>
      <p className="mb-3 text-sm text-navy-500">
        לפני שנפיק את רשימת הנכסים — ענה על שלוש שאלות. הקול שלך הוא הליבה
        היצירתית; השאלה רק מכוונת.
      </p>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={i}>
            <label className="mb-1 block text-sm font-medium text-navy-800">
              {i + 1}. {q.label}
            </label>
            <Textarea
              value={q.value}
              onChange={(e) => q.set(e.target.value)}
              placeholder={q.placeholder}
              rows={2}
            />
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={save.isPending}
          onClick={() => {
            setError(null);
            save.mutate();
          }}
        >
          {save.isPending ? "שומר…" : saved ? "נשמר" : "שמירת תשובות"}
        </Button>
        <Button
          size="sm"
          icon="doc"
          disabled={!allAnswered || generate.isPending}
          title={allAnswered ? undefined : "צריך לענות על שלוש השאלות"}
          onClick={() => {
            setError(null);
            generate.mutate();
          }}
        >
          {generate.isPending
            ? "מפיק תוכנית הפקה…"
            : plan
              ? "הפק מחדש"
              : "הפק תוכנית הפקה"}
        </Button>
      </div>

      {plan && (
        <div className="mt-4 border-t border-navy-100 pt-4">
          <div className="mb-2 text-sm font-semibold text-navy-800">
            הרעיון: <span className="font-normal text-navy-600">{plan.concept}</span>
          </div>
          <div className="space-y-2">
            {plan.items.map((it, i) => (
              <div
                key={i}
                className="rounded-xl border border-navy-100 p-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                    {it.kind}
                  </span>
                  <span className="font-medium text-navy-900">{it.title}</span>
                </div>
                <div className="mt-1 text-navy-600">{it.description}</div>
                <div className="mt-1 text-xs text-navy-400">
                  {it.format} · {it.versions}
                </div>
              </div>
            ))}
          </div>
          {plan.notes.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-navy-500">
              {plan.notes.map((n, i) => (
                <li key={i}>• {n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StageCard({
  n,
  icon,
  title,
  done,
  building,
  body,
}: {
  n: string;
  icon: IconName;
  title: string;
  done: boolean;
  building?: boolean;
  body: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            done ? "bg-teal-50 text-teal-700" : "bg-navy-50 text-navy-400"
          }`}
        >
          <Icon name={icon} size={18} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-navy-400">שלב {n}</span>
            <span className="text-sm font-medium text-navy-900">{title}</span>
            {done ? (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 ring-1 ring-teal-200">
                הושלם
              </span>
            ) : building ? (
              <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] text-navy-400">
                בבנייה
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-2.5 ps-12">{body}</div>
    </Card>
  );
}

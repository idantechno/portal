import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customersApi, type Customer } from "../../api/customers";
import { agentsApi } from "../../api/agents";
import { briefsApi } from "../../api/briefs";
import { strategiesApi } from "../../api/strategies";
import { plansApi } from "../../api/plans";
import { quotesApi } from "../../api/quotes";
import { objectivesApi } from "../../api/objectives";
import { campaignsApi, type Campaign } from "../../api/campaigns";
import {
  websiteIntakeApi,
  type WebsiteIntake,
  type IntakeAsset,
} from "../../api/websiteIntake";
import { apiErrorMessage } from "../../api/client";
import {
  Button,
  Card,
  FormError,
  Input,
  Label,
  Spinner,
  Textarea,
} from "../../components/ui";
import { Icon } from "../../components/icons";

/** ISO datetime → yyyy-mm-dd for an <input type="date">. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function CustomerDetail() {
  const { businessId = "", customerId = "" } = useParams<{
    businessId: string;
    customerId: string;
  }>();

  const customer = useQuery({
    queryKey: ["customer", businessId, customerId],
    queryFn: () => customersApi.get(businessId, customerId),
    enabled: Boolean(businessId && customerId),
  });

  const agents = useQuery({
    queryKey: ["business", businessId, "agents"],
    queryFn: () => agentsApi.forBusiness(businessId),
    enabled: Boolean(businessId),
  });
  const marketingEntitled = (agents.data ?? []).some(
    (a) => a.key === "marketing" && a.entitled,
  );

  if (customer.isLoading || !customer.data) {
    return (
      <div className="grid place-items-center p-10">
        <Spinner />
      </div>
    );
  }

  return (
    // Remount on id change so the editor re-seeds its fields from fresh data.
    <CustomerEditor
      key={customer.data.id}
      businessId={businessId}
      customer={customer.data}
      marketingEntitled={marketingEntitled}
    />
  );
}

function CustomerEditor({
  businessId,
  customer,
  marketingEntitled,
}: {
  businessId: string;
  customer: Customer;
  marketingEntitled: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState(customer.name ?? "");
  const [businessName, setBusinessName] = useState(customer.businessName ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [brandPageReady, setBrandPageReady] = useState(customer.brandPageReady);
  const [brandPageUrl, setBrandPageUrl] = useState(customer.brandPageUrl ?? "");
  const [logoReady, setLogoReady] = useState(customer.logoReady);
  const [logoUrl, setLogoUrl] = useState(customer.logoUrl ?? "");
  const [activityAt, setActivityAt] = useState(
    toDateInput(customer.nextActivityAt),
  );
  const [activityNote, setActivityNote] = useState(
    customer.nextActivityNote ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const customerId = customer.id;

  const save = useMutation({
    mutationFn: () =>
      customersApi.update(businessId, customerId, {
        name: name.trim(),
        businessName: businessName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        brandPageReady,
        brandPageUrl: brandPageUrl.trim() || null,
        logoReady,
        logoUrl: logoUrl.trim() || null,
        nextActivityAt: activityAt
          ? new Date(activityAt).toISOString()
          : null,
        nextActivityNote: activityNote.trim() || null,
      }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      qc.invalidateQueries({ queryKey: ["customer", businessId, customerId] });
      qc.invalidateQueries({ queryKey: ["customers", businessId] });
    },
    onError: (e) => setError(apiErrorMessage(e, "השמירה נכשלה")),
  });

  const remove = useMutation({
    mutationFn: () => customersApi.remove(businessId, customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", businessId] });
      navigate(`/app/businesses/${businessId}/customers`);
    },
    onError: (e) => setError(apiErrorMessage(e, "המחיקה נכשלה")),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <button
        type="button"
        onClick={() => navigate(`/app/businesses/${businessId}/customers`)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <Icon name="chevron-start" size={18} />
        חזרה ללקוחות
      </button>

      {/* Identity */}
      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700">
            <Icon name="user" size={22} />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-lg leading-tight">
              {businessName.trim() || name.trim() || "לקוח"}
            </div>
            <div className="text-xs text-neutral-500">
              {customer.source === "lead" ? "הומר מליד" : "נוצר ידנית"}
            </div>
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>שם איש קשר</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>שם העסק</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <Label>טלפון</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <Label>אימייל</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <Label>הערות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הקשר, סיכומים, מה שחשוב לזכור על הלקוח…"
              rows={3}
            />
          </div>

          {/* Brand assets — made outside the system; a manual confirmation. */}
          <div className="rounded-xl border border-navy-100 p-3">
            <div className="mb-2 text-xs font-semibold text-navy-500">
              נכסי מותג (נוצרים מחוץ למערכת)
            </div>
            <div className="space-y-2.5">
              <BrandAssetRow
                label="דף מותג"
                ready={brandPageReady}
                onToggle={() => setBrandPageReady((v) => !v)}
                url={brandPageUrl}
                onUrl={setBrandPageUrl}
              />
              <BrandAssetRow
                label="לוגו"
                ready={logoReady}
                onToggle={() => setLogoReady((v) => !v)}
                url={logoUrl}
                onUrl={setLogoUrl}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>פעילות קרובה — תאריך</Label>
              <Input
                type="date"
                value={activityAt}
                onChange={(e) => setActivityAt(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <Label>פעילות קרובה — מה</Label>
              <Input
                value={activityNote}
                onChange={(e) => setActivityNote(e.target.value)}
                placeholder="פגישה, שליחת אסטרטגיה…"
              />
            </div>
          </div>

          {error && <FormError message={error} />}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setConfirmDelete((v) => !v)}
              className="text-sm font-medium text-red-700 hover:text-red-800"
            >
              מחיקת לקוח
            </button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? (
                <>
                  <Spinner /> שומר…
                </>
              ) : saved ? (
                "נשמר"
              ) : (
                "שמירה"
              )}
            </Button>
          </div>

          {confirmDelete && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50/60 p-3">
              <span className="text-sm text-navy-700">
                למחוק את הלקוח? הדוחות שהופקו לו לא יימחקו.
              </span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                {remove.isPending ? "מוחק…" : "כן, מחק"}
              </Button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-navy-500 hover:bg-navy-50"
              >
                ביטול
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Intake data captured on the person (questionnaire answers, lead
          payload). Read-only — nothing here is lost from the old leads viewer. */}
      {customer.capturedData && (
        <CapturedDataSection data={customer.capturedData} />
      )}

      {/* Website brief the client submitted through /website-brief */}
      <WebsiteIntakeSection businessId={businessId} customerId={customerId} />

      {/* Marketing work — only if this business has the marketing agent */}
      {marketingEntitled && (
        <>
          <MarketingSection
            businessId={businessId}
            customerId={customerId}
            hasLead={Boolean(customer.leadId)}
          />
          <div className="mt-8">
            <CampaignsSection
              businessId={businessId}
              customerId={customerId}
              customerName={businessName.trim() || name.trim() || "לקוח"}
            />
          </div>
        </>
      )}
    </div>
  );
}

function CampaignsSection({
  businessId,
  customerId,
  customerName,
}: {
  businessId: string;
  customerId: string;
  customerName: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [campaignName, setCampaignName] = useState("");

  const prereqs = useQuery({
    queryKey: ["campaign-prereqs", businessId, customerId],
    queryFn: () => campaignsApi.prerequisites(businessId, customerId),
    enabled: Boolean(businessId && customerId),
  });
  const campaigns = useQuery({
    queryKey: ["campaigns", businessId, "customer", customerId],
    queryFn: () => campaignsApi.list(businessId, customerId),
    enabled: Boolean(businessId && customerId),
  });

  const create = useMutation({
    mutationFn: () =>
      campaignsApi.create(
        businessId,
        customerId,
        campaignName.trim() || `קמפיין — ${customerName}`,
      ),
    onSuccess: (campaign) => {
      qc.invalidateQueries({
        queryKey: ["campaigns", businessId, "customer", customerId],
      });
      navigate(`/app/businesses/${businessId}/campaigns/${campaign.id}`);
    },
    onError: (e) => setError(apiErrorMessage(e, "יצירת הקמפיין נכשלה")),
  });

  const report = prereqs.data;
  const planMet =
    report?.items.find((i) => i.key === "marketing_plan")?.met ?? false;
  const campaignList = campaigns.data ?? [];

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon name="megaphone" size={18} className="text-brand-600" />
        <h2 className="text-sm font-semibold text-navy-500">קמפיינים</h2>
      </div>

      {error && (
        <div className="mb-3">
          <FormError message={error} />
        </div>
      )}

      {/* Existing campaigns */}
      {campaignList.length > 0 && (
        <div className="mb-4 space-y-2">
          {campaignList.map((c) => (
            <CampaignRow key={c.id} campaign={c} businessId={businessId} />
          ))}
        </div>
      )}

      {/* Readiness — plan opens creation; the full list is needed to activate */}
      <Card className="p-4">
        <div className="mb-2.5 text-sm font-medium text-navy-900">
          מוכנות לקמפיין
        </div>
        {prereqs.isLoading ? (
          <div className="text-xs text-navy-400">טוען…</div>
        ) : (
          <ul className="space-y-2">
            {(report?.items ?? []).map((it) => (
              <li key={it.key} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    it.met
                      ? "bg-teal-100 text-teal-700"
                      : it.available
                        ? "bg-coral-100 text-coral-600"
                        : "bg-navy-100 text-navy-400"
                  }`}
                >
                  {it.met ? "✓" : it.available ? "!" : "…"}
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-navy-800">
                    {it.label}
                    {!it.available && (
                      <span className="ms-2 rounded-full bg-navy-50 px-2 py-0.5 text-[10px] text-navy-400">
                        בבנייה
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-navy-400">{it.hint}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-navy-100 pt-3">
          {!planMet ? (
            <p className="text-xs text-navy-400">
              כדי לפתוח קמפיין צריך קודם תוכנית מאושרת (שלב א׳). שאר הדרישות
              נדרשות רק כדי להפעיל את הקמפיין (שלב ג׳).
            </p>
          ) : naming ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder={`קמפיין — ${customerName}`}
                className="w-64"
                autoFocus
              />
              <Button
                size="sm"
                icon="megaphone"
                disabled={create.isPending}
                onClick={() => {
                  setError(null);
                  create.mutate();
                }}
              >
                {create.isPending ? "יוצר…" : "צור"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setNaming(false)}
              >
                ביטול
              </Button>
            </div>
          ) : (
            <Button size="sm" icon="plus" onClick={() => setNaming(true)}>
              צור קמפיין
            </Button>
          )}
        </div>
      </Card>
    </section>
  );
}

function CampaignRow({
  campaign,
  businessId,
}: {
  campaign: Campaign;
  businessId: string;
}) {
  const label =
    campaign.status === "active"
      ? { text: "פעיל", cls: "bg-teal-50 text-teal-700 ring-teal-200" }
      : campaign.status === "done"
        ? { text: "הסתיים", cls: "bg-navy-50 text-navy-500 ring-navy-200" }
        : { text: "בהקמה", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
  return (
    <Link to={`/app/businesses/${businessId}/campaigns/${campaign.id}`}>
      <Card className="flex items-center justify-between gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-e2)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${label.cls}`}
          >
            {label.text}
          </span>
          <span className="truncate text-sm font-medium text-navy-900">
            {campaign.name}
          </span>
        </div>
        <Icon name="chevron-start" size={16} className="shrink-0 text-navy-300" />
      </Card>
    </Link>
  );
}

function MarketingSection({
  businessId,
  customerId,
  hasLead,
}: {
  businessId: string;
  customerId: string;
  hasLead: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");

  const briefs = useQuery({
    queryKey: ["briefs", businessId, "customer", customerId],
    queryFn: () => briefsApi.list(businessId, customerId),
    enabled: Boolean(businessId && customerId),
  });
  const strategies = useQuery({
    queryKey: ["strategies", businessId, "customer", customerId],
    queryFn: () => strategiesApi.list(businessId, customerId),
    enabled: Boolean(businessId && customerId),
  });
  const plans = useQuery({
    queryKey: ["plans", businessId, "customer", customerId],
    queryFn: () => plansApi.list(businessId, customerId),
    enabled: Boolean(businessId && customerId),
  });
  const quotes = useQuery({
    queryKey: ["quotes", businessId, "customer", customerId],
    queryFn: () => quotesApi.list(businessId, customerId),
    enabled: Boolean(businessId && customerId),
  });
  const objectives = useQuery({
    queryKey: ["objectives", businessId, "customer", customerId],
    queryFn: () => objectivesApi.list(businessId, customerId),
    enabled: Boolean(businessId && customerId),
  });

  const briefList = briefs.data ?? [];
  const quoteList = quotes.data ?? [];
  const objectiveList = objectives.data ?? [];
  const strategyList = strategies.data ?? [];
  const planList = plans.data ?? [];
  const approvedBrief = briefList.find((b) => b.status === "approved") ?? null;
  const approvedStrategy =
    strategyList.find((s) => s.status === "approved") ?? null;

  const stage = (() => {
    if (planList.some((p) => p.status === "approved"))
      return { label: "תוכנית מאושרת — בעבודה", tone: "teal" as const };
    if (planList.length > 0)
      return { label: "תוכנית בטיוטה", tone: "amber" as const };
    if (approvedStrategy)
      return {
        label: "אסטרטגיה מאושרת — אפשר להפיק תוכנית",
        tone: "teal" as const,
      };
    if (strategyList.length > 0)
      return { label: "אסטרטגיה בטיוטה", tone: "amber" as const };
    if (approvedBrief)
      return {
        label: "בריף מאושר — אפשר להפיק אסטרטגיה",
        tone: "teal" as const,
      };
    if (briefList.length > 0)
      return { label: "בריף בטיוטה — ממתין לאישור", tone: "amber" as const };
    return { label: "טרם הופק בריף", tone: "neutral" as const };
  })();

  const generateBrief = useMutation({
    mutationFn: () =>
      briefsApi.generateForCustomer(businessId, customerId, {
        websiteUrl: website.trim() || undefined,
      }),
    onSuccess: (brief) => {
      qc.invalidateQueries({
        queryKey: ["briefs", businessId, "customer", customerId],
      });
      navigate(`/app/businesses/${businessId}/briefs/${brief.id}`);
    },
    onError: (e) => setError(apiErrorMessage(e, "הפקת הבריף נכשלה")),
  });

  const generateStrategy = useMutation({
    mutationFn: (briefId: string) => strategiesApi.generate(businessId, briefId),
    onSuccess: (strategy) => {
      qc.invalidateQueries({
        queryKey: ["strategies", businessId, "customer", customerId],
      });
      navigate(`/app/businesses/${businessId}/strategies/${strategy.id}`);
    },
    onError: (e) => setError(apiErrorMessage(e, "הפקת האסטרטגיה נכשלה")),
  });

  const generatePlan = useMutation({
    mutationFn: (strategyId: string) => plansApi.generate(businessId, strategyId),
    onSuccess: (plan) => {
      qc.invalidateQueries({
        queryKey: ["plans", businessId, "customer", customerId],
      });
      navigate(`/app/businesses/${businessId}/plans/${plan.id}`);
    },
    onError: (e) => setError(apiErrorMessage(e, "הפקת התוכנית נכשלה")),
  });

  const generateObjectives = useMutation({
    mutationFn: () => objectivesApi.generate(businessId, customerId),
    onSuccess: (objective) => {
      qc.invalidateQueries({
        queryKey: ["objectives", businessId, "customer", customerId],
      });
      navigate(`/app/businesses/${businessId}/objectives/${objective.id}`);
    },
    onError: (e) => setError(apiErrorMessage(e, "הפקת היעדים והמטרות נכשלה")),
  });

  const toneClass = {
    teal: "bg-teal-50 text-teal-700 ring-teal-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    neutral: "bg-navy-50 text-navy-500 ring-navy-200",
  }[stage.tone];

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Icon name="megaphone" size={18} className="text-brand-600" />
        <h2 className="text-sm font-semibold text-navy-500">תוכנית שיווק</h2>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${toneClass}`}
        >
          {stage.label}
        </span>
      </div>

      {error && (
        <div className="mb-3">
          <FormError message={error} />
        </div>
      )}

      {/* Reports, grouped */}
      <div className="mb-4 space-y-4">
        <ReportGroup
          title="בריפים"
          items={briefList.map((b) => ({
            id: b.id,
            title: b.title,
            approved: b.status === "approved",
            to: `/app/businesses/${businessId}/briefs/${b.id}`,
          }))}
          empty="עוד לא הופק בריף"
        />
        <ReportGroup
          title="אסטרטגיות"
          items={strategyList.map((s) => ({
            id: s.id,
            title: s.title,
            approved: s.status === "approved",
            to: `/app/businesses/${businessId}/strategies/${s.id}`,
          }))}
          empty="עוד לא הופקה אסטרטגיה"
        />
        <ReportGroup
          title="יעדים ומטרות"
          items={objectiveList.map((o) => ({
            id: o.id,
            title: o.title,
            approved: o.status === "approved",
            to: `/app/businesses/${businessId}/objectives/${o.id}`,
          }))}
          empty="עוד לא הופק מסמך יעדים ומטרות"
        />
        <ReportGroup
          title="הצעות מחיר"
          items={quoteList.map((q) => ({
            id: q.id,
            title: q.title,
            approved: q.status === "approved",
            to: `/app/businesses/${businessId}/quotes/${q.id}`,
          }))}
          empty="עוד לא נבנתה הצעת מחיר (נבנית אצל סוכן הצעות המחיר)"
        />
        <ReportGroup
          title="תוכניות עבודה"
          items={planList.map((p) => ({
            id: p.id,
            title: p.title,
            approved: p.status === "approved",
            to: `/app/businesses/${businessId}/plans/${p.id}`,
          }))}
          empty="עוד לא הופקה תוכנית"
        />
      </div>

      {/* Actions */}
      <Card className="space-y-3 p-4">
        <div>
          <div className="mb-1.5 text-sm font-medium text-navy-900">
            הפקת בריף {briefList.length > 0 ? "נוסף" : ""}
          </div>
          {hasLead ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="example.co.il (רשות)"
                dir="ltr"
                className="w-56"
                disabled={generateBrief.isPending}
              />
              <Button
                size="sm"
                icon="megaphone"
                disabled={generateBrief.isPending}
                onClick={() => {
                  setError(null);
                  generateBrief.mutate();
                }}
              >
                {generateBrief.isPending ? "מפיק בריף…" : "הפק בריף"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-navy-400">
              ללקוח הזה אין שאלון אסטרטגיה, אז אין ממה להפיק בריף. אפשר להמיר ליד
              משאלון ללקוח (ואז הבריף יופק ממנו).
            </p>
          )}
        </div>

        {approvedBrief && (
          <div className="border-t border-navy-100 pt-3">
            <Button
              size="sm"
              variant="secondary"
              icon="megaphone"
              disabled={generateStrategy.isPending}
              onClick={() => {
                setError(null);
                generateStrategy.mutate(approvedBrief.id);
              }}
            >
              {generateStrategy.isPending
                ? "מפיק אסטרטגיה…"
                : "הפק אסטרטגיה מהבריף"}
            </Button>
          </div>
        )}

        {approvedStrategy && (
          <div className="border-t border-navy-100 pt-3">
            <Button
              size="sm"
              variant="secondary"
              icon="tasks"
              disabled={generatePlan.isPending}
              onClick={() => {
                setError(null);
                generatePlan.mutate(approvedStrategy.id);
              }}
            >
              {generatePlan.isPending
                ? "מפיק תוכנית…"
                : "הפק תוכנית מהאסטרטגיה"}
            </Button>
          </div>
        )}

        {approvedBrief && (
          <div className="border-t border-navy-100 pt-3">
            <Button
              size="sm"
              variant="secondary"
              icon="compass"
              disabled={generateObjectives.isPending}
              onClick={() => {
                setError(null);
                generateObjectives.mutate();
              }}
            >
              {generateObjectives.isPending
                ? "מפיק יעדים ומטרות…"
                : "הפק יעדים ומטרות מהבריף"}
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}

/** Hebrew labels for the well-known intake keys; unknown keys print as-is. */
const CAPTURED_LABELS: Record<string, string> = {
  businessName: "שם העסק",
  businessType: "סוג העסק",
  audience: "קהל יעד",
  preferredChannel: "ערוץ מועדף",
  contactName: "איש קשר",
  phone: "טלפון",
  email: "אימייל",
  interest: "מתעניין ב",
  notes: "הערות",
};

type CapturedSection = {
  title?: string;
  items?: { label?: string; value?: unknown }[];
};

/** Renders one captured payload: its scalar fields, then any answer sections. */
function CapturedPayload({ data }: { data: Record<string, unknown> }) {
  const scalars = Object.entries(data).filter(
    ([k, v]) =>
      k !== "sections" &&
      k !== "history" &&
      (typeof v === "string" || typeof v === "number") &&
      String(v).trim() !== "",
  );
  const sections = Array.isArray(data.sections)
    ? (data.sections as CapturedSection[])
    : [];

  if (scalars.length === 0 && sections.length === 0) {
    return <p className="text-sm text-navy-400">אין פרטים שנקלטו.</p>;
  }

  return (
    <div className="space-y-4">
      {scalars.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-brand-50/50 p-3.5 text-sm">
          {scalars.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-navy-400">
                {CAPTURED_LABELS[k] ?? k}
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap font-medium text-navy-900">
                {String(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {sections.map((section, i) => (
        <div key={i}>
          {section.title && (
            <h3 className="mb-2 text-xs font-semibold uppercase text-navy-400">
              {section.title}
            </h3>
          )}
          <dl className="space-y-1.5">
            {(section.items ?? []).map((item, j) => (
              <div key={j} className="text-sm">
                <dt className="text-navy-500">{item.label}</dt>
                <dd className="whitespace-pre-wrap text-navy-900">
                  {item.value == null ? "" : String(item.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/**
 * Read-only view of a person's `capturedData` — the questionnaire answers / lead
 * payload the unification moved onto the person. `upsertPerson` accumulates
 * repeat submissions under `capturedData.history[]`, so the latest payload shows
 * first and earlier ones follow.
 */
function CapturedDataSection({ data }: { data: Record<string, unknown> }) {
  const history = Array.isArray(data.history)
    ? (data.history as Record<string, unknown>[])
    : [];
  // Newest first: the root payload, then each historical one in reverse.
  const payloads = [data, ...[...history].reverse()];

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="doc" size={18} className="text-brand-600" />
        <h2 className="text-sm font-semibold text-navy-500">מידע שנקלט</h2>
      </div>
      <div className="space-y-4">
        {payloads.map((payload, i) => (
          <Card key={i} className="p-5">
            {payloads.length > 1 && (
              <div className="mb-2.5 text-xs font-medium text-navy-400">
                {i === 0 ? "פנייה אחרונה" : `פנייה קודמת ${i}`}
              </div>
            )}
            <CapturedPayload data={payload} />
          </Card>
        ))}
      </div>
    </section>
  );
}

function WebsiteIntakeSection({
  businessId,
  customerId,
}: {
  businessId: string;
  customerId: string;
}) {
  const intakes = useQuery({
    queryKey: ["website-intakes", businessId, customerId],
    queryFn: () => websiteIntakeApi.listForCustomer(businessId, customerId),
    enabled: Boolean(businessId && customerId),
  });

  const list = intakes.data ?? [];
  if (list.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="compass" size={18} className="text-brand-600" />
        <h2 className="text-sm font-semibold text-navy-500">בריף אתר</h2>
      </div>
      <div className="space-y-4">
        {list.map((intake) => (
          <IntakeCard key={intake.id} businessId={businessId} intake={intake} />
        ))}
      </div>
    </section>
  );
}

function IntakeCard({
  businessId,
  intake,
}: {
  businessId: string;
  intake: WebsiteIntake;
}) {
  const date = new Date(intake.createdAt).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const [downloading, setDownloading] = useState(false);
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const url = await websiteIntakeApi.operatorPdfBlobUrl(
        businessId,
        intake.id,
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `בריף-אתר-${intake.businessName || intake.contactName || "brief"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="font-display text-base leading-tight">
          {intake.businessName || intake.contactName}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-navy-400">{date}</span>
          <Button
            size="sm"
            variant="secondary"
            icon="download"
            onClick={downloadPdf}
            disabled={downloading}
          >
            {downloading ? "מכין…" : "PDF"}
          </Button>
        </div>
      </div>

      {/* Answers */}
      <div className="space-y-4">
        {intake.sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase text-navy-400">
              {section.title}
            </h3>
            <dl className="space-y-1.5">
              {section.items.map((it, i) => (
                <div key={i} className="text-sm">
                  <dt className="text-navy-500">{it.label}</dt>
                  <dd className="whitespace-pre-wrap text-navy-900">
                    {it.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* Assets */}
      {(intake.logo || intake.images.length > 0) && (
        <div className="mt-4 border-t border-navy-100 pt-4">
          {intake.logo && (
            <div className="mb-3">
              <h3 className="mb-1.5 text-xs font-semibold uppercase text-navy-400">
                לוגו
              </h3>
              <IntakeAssetTile
                businessId={businessId}
                intakeId={intake.id}
                kind="logo"
                index={0}
                asset={intake.logo}
                contain
              />
            </div>
          )}
          {intake.images.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase text-navy-400">
                תמונות ({intake.images.length})
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {intake.images.map((img, i) => (
                  <IntakeAssetTile
                    key={i}
                    businessId={businessId}
                    intakeId={intake.id}
                    kind="image"
                    index={i}
                    asset={img}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Fetches one asset (with auth) and shows a thumbnail that opens full-size in
 *  a new tab on click. */
function IntakeAssetTile({
  businessId,
  intakeId,
  kind,
  index,
  asset,
  contain,
}: {
  businessId: string;
  intakeId: string;
  kind: "logo" | "image";
  index: number;
  asset: IntakeAsset;
  contain?: boolean;
}) {
  const blob = useQuery({
    queryKey: ["intake-asset", businessId, intakeId, kind, index],
    queryFn: () =>
      websiteIntakeApi.assetObjectUrl(businessId, intakeId, kind, index),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const cls = contain
    ? "h-20 w-20 rounded-xl border border-navy-100 bg-navy-50 object-contain p-1"
    : "aspect-square w-full rounded-xl border border-navy-100 object-cover";

  if (!blob.data) {
    return (
      <div
        className={`${contain ? "h-20 w-20" : "aspect-square w-full"} grid place-items-center rounded-xl border border-navy-100 bg-navy-50`}
      >
        <Spinner />
      </div>
    );
  }

  return (
    <a
      href={blob.data}
      target="_blank"
      rel="noreferrer"
      title={asset.name}
      className="block transition hover:opacity-90"
    >
      <img src={blob.data} alt={asset.name} className={cls} />
    </a>
  );
}

function BrandAssetRow({
  label,
  ready,
  onToggle,
  url,
  onUrl,
}: {
  label: string;
  ready: boolean;
  onToggle: () => void;
  url: string;
  onUrl: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition ${
          ready
            ? "bg-teal-50 text-teal-700 ring-teal-200"
            : "bg-navy-50 text-navy-500 ring-navy-200"
        }`}
      >
        <Icon name={ready ? "check-circle" : "close"} size={14} />
        {label}
        {ready ? " — קיים" : " — לא סומן"}
      </button>
      <Input
        value={url}
        onChange={(e) => onUrl(e.target.value)}
        placeholder="קישור (רשות)"
        dir="ltr"
        className="h-8 w-48 text-xs"
      />
    </div>
  );
}

function ReportGroup({
  title,
  items,
  empty,
}: {
  title: string;
  items: { id: string; title: string; approved: boolean; to: string }[];
  empty: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase text-navy-400">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-navy-300">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Link key={it.id} to={it.to}>
              <Card className="flex items-center justify-between gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-e2)]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                      it.approved
                        ? "bg-teal-50 text-teal-700 ring-teal-200"
                        : "bg-coral-50 text-coral-600 ring-coral-200"
                    }`}
                  >
                    {it.approved ? "מאושר" : "טיוטה"}
                  </span>
                  <span className="truncate text-sm font-medium text-navy-900">
                    {it.title}
                  </span>
                </div>
                <Icon
                  name="chevron-start"
                  size={16}
                  className="shrink-0 text-navy-300"
                />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

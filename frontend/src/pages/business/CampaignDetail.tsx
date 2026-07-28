import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { campaignsApi, type CampaignStatus } from "../../api/campaigns";
import { apiErrorMessage } from "../../api/client";
import { Button, Card, FormError, Spinner } from "../../components/ui";
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

  if (campaign.isLoading || !campaign.data) {
    return (
      <div className="grid place-items-center p-10">
        <Spinner />
      </div>
    );
  }

  const c = campaign.data;
  const status = STATUS_LABEL[c.status];
  // All three stages complete → the campaign can go live. B/C aren't built yet,
  // so this stays false for now (honest shell).
  const stageA = Boolean(c.marketingPlanId);
  const stageB = Boolean(c.productionPlan);
  const stageC = Boolean(c.schedule);
  const ready = stageA && stageB && stageC;

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
              disabled={!ready || update.isPending}
              title={ready ? undefined : "צריך להשלים את שלושת השלבים"}
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
          building
          body={
            <span className="text-sm text-navy-400">
              רשימת הסרטונים, התמונות, המודעות, הטקסטים, הפורמטים והגרסאות לייצור.
              (בבנייה)
            </span>
          }
        />
        <StageCard
          n="ג'"
          icon="calendar"
          title="לו״ז"
          done={stageC}
          building
          body={
            <span className="text-sm text-navy-400">
              לוח זמנים (חודשי / חצי-שנה / שנה): באיזה ערוץ כל פריט מתפרסם, מתי,
              וכמה תקציב מושקע. (בבנייה)
            </span>
          }
        />
      </div>

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

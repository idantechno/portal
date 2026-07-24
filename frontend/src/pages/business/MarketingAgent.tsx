import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { briefsApi, type Brief } from "../../api/briefs";
import { leadsApi, type Lead } from "../../api/leads";
import { apiErrorMessage } from "../../api/client";
import {
  Button,
  Card,
  EmptyState,
  FormError,
  Input,
  Spinner,
} from "../../components/ui";
import { Icon } from "../../components/icons";

/**
 * The marketing agent's home. Entitlement-gated (only businesses an admin has
 * granted the "marketing" agent reach this — the backend enforces the same on
 * every /briefs route). From here the operator turns any questionnaire lead
 * into a business brief.
 */
export default function MarketingAgent({ businessId }: { businessId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const agents = useQuery({
    queryKey: ["business", businessId, "agents"],
    queryFn: () => agentsApi.forBusiness(businessId),
    enabled: Boolean(businessId),
  });
  const briefs = useQuery({
    queryKey: ["briefs", businessId],
    queryFn: () => briefsApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const leads = useQuery({
    queryKey: ["leads", businessId],
    queryFn: () => leadsApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const remove = useMutation({
    mutationFn: (id: string) => briefsApi.remove(businessId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefs", businessId] }),
    onError: (err) => setError(apiErrorMessage(err, "מחיקת הבריף נכשלה")),
  });

  if (agents.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  // Not entitled (or the grant was revoked) — the agent hub is the safe landing.
  const entitled = (agents.data ?? []).some((a) => a.key === "marketing");
  if (!entitled) {
    return <Navigate to={`/app/businesses/${businessId}/agents`} replace />;
  }

  const briefList = briefs.data ?? [];
  const briefByLead = new Map(
    briefList.filter((b) => b.leadId).map((b) => [b.leadId as string, b]),
  );
  const questionnaireLeads = (leads.data ?? []).filter(
    (l) => l.source === "questionnaire",
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon name="megaphone" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">סוכן שיווק</h1>
          <p className="text-sm text-neutral-600">
            הופך שאלון אסטרטגיה שמילא לקוח לבריף עסקי מלא — מקור-אמת אחד לתוכן
            ואסטרטגיה. שדות 🟠 הם טיוטה שדורשת אישור שלך.
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <FormError message={error} />
        </div>
      )}

      {/* Existing briefs */}
      {briefList.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-navy-500">
            בריפים שהופקו
          </h2>
          <div className="space-y-2.5">
            {briefList.map((brief) => (
              <BriefRow
                key={brief.id}
                brief={brief}
                businessId={businessId}
                onDelete={() => {
                  if (confirm("למחוק את הבריף?")) remove.mutate(brief.id);
                }}
                deleting={remove.isPending && remove.variables === brief.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Generate from a questionnaire lead */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-navy-500">
          הפקת בריף מליד
        </h2>
        {leads.isLoading ? (
          <div className="text-sm text-neutral-500">טוען לידים…</div>
        ) : questionnaireLeads.length === 0 ? (
          <Card>
            <EmptyState
              icon="leads"
              title="אין עדיין לידים משאלון"
              text="בריף מופק רק מליד שמילא את שאלון האסטרטגיה (/strategy). ברגע שיגיע כזה — הוא יופיע כאן."
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
                  void qc.invalidateQueries({
                    queryKey: ["briefs", businessId],
                  });
                  navigate(`/app/businesses/${businessId}/briefs/${brief.id}`);
                }}
                onError={setError}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BriefRow({
  brief,
  businessId,
  onDelete,
  deleting,
}: {
  brief: Brief;
  businessId: string;
  onDelete: () => void;
  deleting: boolean;
}) {
  const approved = brief.status === "approved";
  return (
    <Card className="flex items-center justify-between gap-3 p-3.5">
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

function LeadRow({
  lead,
  businessId,
  existing,
  onGenerated,
  onError,
}: {
  lead: Lead;
  businessId: string;
  existing: Brief | null;
  onGenerated: (brief: Brief) => void;
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

  return (
    <Card className="p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-navy-900">
            {lead.name}
          </div>
          <div className="truncate text-xs text-navy-400">{lead.interest}</div>
        </div>
        <div className="flex shrink-0 gap-2">
          {existing && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                navigate(
                  `/app/businesses/${businessId}/briefs/${existing.id}`,
                )
              }
            >
              פתיחת הבריף
            </Button>
          )}
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

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { briefsApi, type Brief } from "../../api/briefs";
import { apiErrorMessage } from "../../api/client";
import { BriefMarkdown } from "../../components/BriefMarkdown";
import { Button, Card, FormError, Input, Textarea } from "../../components/ui";
import { Icon } from "../../components/icons";

/** Reads the counters the generator stored alongside the markdown. */
function summaryOf(brief: Brief | undefined) {
  const p = (brief?.payload ?? {}) as {
    contradictions?: unknown[];
    draft?: { openQuestions?: unknown[] };
    extraction?: { pages?: unknown[] };
    facts?: { missing?: unknown[] };
  };
  return {
    contradictions: p.contradictions?.length ?? 0,
    openQuestions: p.draft?.openQuestions?.length ?? 0,
    pages: p.extraction?.pages?.length ?? 0,
    unanswered: p.facts?.missing?.length ?? 0,
  };
}

export default function BriefDetail() {
  const { businessId = "", briefId = "" } = useParams<{
    businessId: string;
    briefId: string;
  }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // `null` = showing the server's copy; a string = the operator's unsaved edit.
  const [edit, setEdit] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brief = useQuery({
    queryKey: ["brief", businessId, briefId],
    queryFn: () => briefsApi.get(businessId, briefId),
    enabled: Boolean(businessId && briefId),
  });

  const text = edit ?? brief.data?.markdown ?? "";
  const editing = edit !== null;

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof briefsApi.update>[2]) =>
      briefsApi.update(businessId, briefId, patch),
    onSuccess: (updated) => {
      qc.setQueryData(["brief", businessId, briefId], updated);
      void qc.invalidateQueries({ queryKey: ["briefs", businessId] });
      setEdit(null);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err, "השמירה נכשלה")),
  });

  // Regeneration is a two-step reveal, not a one-click: the operator can set a
  // different website (or none) and back out before spending a model run.
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenWebsite, setRegenWebsite] = useState("");

  const regenerate = useMutation({
    mutationFn: () => {
      const lead = brief.data?.leadId;
      if (!lead) throw new Error("no-lead");
      return briefsApi.generate(businessId, lead, {
        websiteUrl: regenWebsite.trim() || undefined,
      });
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["briefs", businessId] });
      navigate(`/app/businesses/${businessId}/briefs/${created.id}`);
    },
    onError: (err) =>
      setError(apiErrorMessage(err, "ההפקה מחדש נכשלה — נסה שוב")),
  });

  const backToAgent = `/app/businesses/${businessId}/agents/marketing`;

  const remove = useMutation({
    mutationFn: () => briefsApi.remove(businessId, briefId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["briefs", businessId] });
      navigate(backToAgent);
    },
    onError: (err) => setError(apiErrorMessage(err, "המחיקה נכשלה")),
  });

  const data = brief.data;
  const stats = summaryOf(data);
  const approved = data?.status === "approved";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("ההעתקה נכשלה — אפשר לסמן ולהעתיק ידנית");
    }
  }

  function download() {
    const name = (data?.title ?? "brief").replace(/[\\/:*?"<>|]/g, "-");
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (brief.isLoading) {
    return (
      <div className="px-4 py-8 text-sm text-neutral-500 sm:px-6">טוען…</div>
    );
  }
  if (!data) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <FormError message="הבריף לא נמצא" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        to={backToAgent}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-800"
      >
        <Icon name="arrow-start" size={16} />
        סוכן שיווק
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="mb-1 truncate text-2xl font-bold">{data.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-navy-400">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ring-1 ${
                approved
                  ? "bg-teal-50 text-teal-700 ring-teal-200"
                  : "bg-coral-50 text-coral-600 ring-coral-200"
              }`}
            >
              {approved ? "מאושר" : "טיוטה — טעון אישור"}
            </span>
            <span dir="ltr">
              {new Date(data.updatedAt).toLocaleString("he-IL")}
            </span>
            {data.model && <span dir="ltr">{data.model}</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon="paperclip" onClick={copy}>
            {copied ? "הועתק" : "העתקה"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="download"
            onClick={download}
          >
            הורדה
          </Button>
          {editing ? (
            <>
              <Button
                size="sm"
                icon="check-circle"
                disabled={save.isPending}
                onClick={() => save.mutate({ markdown: text })}
              >
                שמירה
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
                ביטול
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              icon="pencil"
              onClick={() => setEdit(data.markdown ?? "")}
            >
              עריכה
            </Button>
          )}
          <Button
            size="sm"
            variant={approved ? "ghost" : "teal"}
            icon="check-circle"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({ status: approved ? "draft" : "approved" })
            }
          >
            {approved ? "החזרה לטיוטה" : "אישור הבריף"}
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <FormError message={error} />
        </div>
      )}

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="סתירות לבירור"
            value={stats.contradictions}
            tone={stats.contradictions ? "warn" : "ok"}
          />
          <Stat
            label="שאלות פתוחות"
            value={stats.openQuestions}
            tone={stats.openQuestions ? "warn" : "ok"}
          />
          <Stat label="עמודים שנסרקו" value={stats.pages} tone="plain" />
          <Stat
            label="שאלות ללא מענה"
            value={stats.unanswered}
            tone={stats.unanswered ? "warn" : "ok"}
          />
        </div>
        {data.websiteUrl && (
          <p className="mt-3 truncate text-xs text-navy-400" dir="ltr">
            {data.websiteUrl}
          </p>
        )}
      </Card>

      <Card className="p-5 sm:p-7">
        {editing ? (
          <Textarea
            value={text}
            onChange={(e) => setEdit(e.target.value)}
            className="min-h-[70vh] font-mono text-xs leading-6"
            dir="rtl"
          />
        ) : (
          <BriefMarkdown source={text} />
        )}
      </Card>

      <div className="mt-6">
        {regenOpen ? (
          <Card className="p-4">
            <p className="mb-2.5 text-sm font-medium text-navy-800">
              הפקה מחדש מהשאלון
            </p>
            <p className="mb-3 text-xs text-navy-400">
              אפשר לשנות/להוסיף כתובת אתר לחילוץ 🟢, או להשאיר ריק. ההפקה מייצרת
              בריף חדש מאותו שאלון — הבריף הנוכחי לא נמחק.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={regenWebsite}
                onChange={(e) => setRegenWebsite(e.target.value)}
                placeholder="example.co.il (רשות)"
                dir="ltr"
                className="w-56"
                disabled={regenerate.isPending}
              />
              <Button
                size="sm"
                icon="refresh"
                disabled={!data.leadId || regenerate.isPending}
                onClick={() => regenerate.mutate()}
              >
                {regenerate.isPending ? "מפיק מחדש…" : "הפק מחדש"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={regenerate.isPending}
                onClick={() => setRegenOpen(false)}
              >
                חזרה
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              disabled={!data.leadId}
              onClick={() => {
                setRegenWebsite(data.websiteUrl ?? "");
                setRegenOpen(true);
              }}
            >
              הפקה מחדש מהשאלון
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="trash"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm("למחוק את הבריף?")) remove.mutate();
              }}
            >
              מחיקה
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warn" | "ok" | "plain";
}) {
  const color =
    tone === "warn"
      ? "text-coral-600"
      : tone === "ok"
        ? "text-teal-600"
        : "text-navy-800";
  return (
    <div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-navy-400">{label}</div>
    </div>
  );
}

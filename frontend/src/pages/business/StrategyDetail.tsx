import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { strategiesApi, type Strategy } from "../../api/strategies";
import { apiErrorMessage } from "../../api/client";
import { BriefMarkdown } from "../../components/BriefMarkdown";
import { Button, Card, FormError, Textarea } from "../../components/ui";
import { Icon } from "../../components/icons";

/** Reads the counters the generator stored alongside the markdown. */
function summaryOf(strategy: Strategy | undefined) {
  const p = (strategy?.payload ?? {}) as {
    draft?: {
      proofIsBlocker?: boolean;
      audiences?: unknown[];
      roadmap?: unknown[];
      blockingDecisions?: unknown[];
    };
  };
  return {
    proofBlocker: Boolean(p.draft?.proofIsBlocker),
    audiences: p.draft?.audiences?.length ?? 0,
    roadmap: p.draft?.roadmap?.length ?? 0,
    decisions: p.draft?.blockingDecisions?.length ?? 0,
  };
}

export default function StrategyDetail() {
  const { businessId = "", strategyId = "" } = useParams<{
    businessId: string;
    strategyId: string;
  }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // `null` = showing the server's copy; a string = the operator's unsaved edit.
  const [edit, setEdit] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strategy = useQuery({
    queryKey: ["strategy", businessId, strategyId],
    queryFn: () => strategiesApi.get(businessId, strategyId),
    enabled: Boolean(businessId && strategyId),
  });

  const text = edit ?? strategy.data?.markdown ?? "";
  const editing = edit !== null;

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof strategiesApi.update>[2]) =>
      strategiesApi.update(businessId, strategyId, patch),
    onSuccess: (updated) => {
      qc.setQueryData(["strategy", businessId, strategyId], updated);
      void qc.invalidateQueries({ queryKey: ["strategies", businessId] });
      setEdit(null);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err, "השמירה נכשלה")),
  });

  // Regeneration builds a fresh strategy from the same (still-approved) brief —
  // the current one is not deleted.
  const [regenOpen, setRegenOpen] = useState(false);

  const regenerate = useMutation({
    mutationFn: () => {
      const brief = strategy.data?.briefId;
      if (!brief) throw new Error("no-brief");
      return strategiesApi.generate(businessId, brief);
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["strategies", businessId] });
      navigate(`/app/businesses/${businessId}/strategies/${created.id}`);
    },
    onError: (err) =>
      setError(apiErrorMessage(err, "ההפקה מחדש נכשלה — נסה שוב")),
  });

  const backToAgent = `/app/businesses/${businessId}/agents/marketing`;

  const remove = useMutation({
    mutationFn: () => strategiesApi.remove(businessId, strategyId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["strategies", businessId] });
      navigate(backToAgent);
    },
    onError: (err) => setError(apiErrorMessage(err, "המחיקה נכשלה")),
  });

  const data = strategy.data;
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
    const name = (data?.title ?? "strategy").replace(/[\\/:*?"<>|]/g, "-");
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name} — אסטרטגיה.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (strategy.isLoading) {
    return (
      <div className="px-4 py-8 text-sm text-neutral-500 sm:px-6">טוען…</div>
    );
  }
  if (!data) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <FormError message="האסטרטגיה לא נמצאה" />
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
              {approved ? "מאושרת" : "טיוטה — טעונת אישור"}
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
            {approved ? "החזרה לטיוטה" : "אישור האסטרטגיה"}
          </Button>
        </div>
      </header>

      {!approved && (
        <div className="mb-4 rounded-xl border border-coral-200 bg-coral-50/60 px-4 py-2.5 text-xs text-coral-700">
          🛑 טיוטה — לא לשליחה ללקוח לפני מעבר ואישור ידני.
        </div>
      )}

      {error && (
        <div className="mb-4">
          <FormError message={error} />
        </div>
      )}

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="חסם הוכחה"
            value={stats.proofBlocker ? "כן" : "לא"}
            tone={stats.proofBlocker ? "warn" : "ok"}
          />
          <Stat label="קהלים" value={stats.audiences} tone="plain" />
          <Stat label="שלבי מפת דרך" value={stats.roadmap} tone="plain" />
          <Stat
            label="החלטות חוסמות"
            value={stats.decisions}
            tone={stats.decisions ? "warn" : "ok"}
          />
        </div>
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
              הפקה מחדש מהבריף
            </p>
            <p className="mb-3 text-xs text-navy-400">
              ההפקה מייצרת אסטרטגיה חדשה מאותו בריף מאושר — האסטרטגיה הנוכחית לא
              נמחקת.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                icon="refresh"
                disabled={!data.briefId || regenerate.isPending}
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
              disabled={!data.briefId}
              onClick={() => setRegenOpen(true)}
            >
              הפקה מחדש מהבריף
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="trash"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm("למחוק את האסטרטגיה?")) remove.mutate();
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
  value: number | string;
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

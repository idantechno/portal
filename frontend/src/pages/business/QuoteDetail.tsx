import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  quotesApi,
  type Quote,
  type QuoteChannel,
} from "../../api/quotes";
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

export default function QuoteDetail() {
  const { businessId = "", quoteId = "" } = useParams<{
    businessId: string;
    quoteId: string;
  }>();

  const quote = useQuery({
    queryKey: ["quote", businessId, quoteId],
    queryFn: () => quotesApi.get(businessId, quoteId),
    enabled: Boolean(businessId && quoteId),
  });

  if (quote.isLoading || !quote.data) {
    return (
      <div className="grid place-items-center p-10">
        <Spinner />
      </div>
    );
  }

  // Remount on id change so the editor re-seeds from fresh data.
  return <QuoteEditor key={quote.data.id} businessId={businessId} quote={quote.data} />;
}

function QuoteEditor({
  businessId,
  quote,
}: {
  businessId: string;
  quote: Quote;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState(quote.title ?? "");
  const [journey, setJourney] = useState(quote.journey ?? "");
  const [channels, setChannels] = useState<QuoteChannel[]>(
    quote.channels?.length ? quote.channels : [],
  );
  const [budgetSummary, setBudgetSummary] = useState(quote.budgetSummary ?? "");
  const [total, setTotal] = useState(quote.total ?? "");
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const approved = quote.status === "approved";
  const quoteId = quote.id;

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof quotesApi.update>[2]) =>
      quotesApi.update(businessId, quoteId, patch),
    onSuccess: (updated) => {
      qc.setQueryData(["quote", businessId, quoteId], updated);
      void qc.invalidateQueries({ queryKey: ["quotes", businessId] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 1500);
    },
    onError: (e) => setError(apiErrorMessage(e, "השמירה נכשלה")),
  });

  const remove = useMutation({
    mutationFn: () => quotesApi.remove(businessId, quoteId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quotes", businessId] });
      navigate(`/app/businesses/${businessId}/agents/quote`);
    },
    onError: (e) => setError(apiErrorMessage(e, "המחיקה נכשלה")),
  });

  const currentBody = () => ({
    title: title.trim() || "הצעת מחיר",
    journey,
    channels: channels
      .map((c) => ({
        name: c.name.trim(),
        description: c.description.trim(),
        budget: c.budget.trim(),
      }))
      .filter((c) => c.name || c.description || c.budget),
    budgetSummary,
    total: total.trim(),
    notes: notes.trim(),
  });

  const setChannel = (i: number, patch: Partial<QuoteChannel>) =>
    setChannels((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        to={`/app/businesses/${businessId}/agents/quote`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-800"
      >
        <Icon name="arrow-start" size={16} />
        סוכן הצעות מחיר
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="mb-1 truncate text-2xl font-bold">
            {title.trim() || "הצעת מחיר"}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
              approved
                ? "bg-teal-50 text-teal-700 ring-teal-200"
                : "bg-coral-50 text-coral-600 ring-coral-200"
            }`}
          >
            {approved ? "מאושרת" : "טיוטה"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon="check-circle"
            disabled={save.isPending}
            onClick={() => save.mutate(currentBody())}
          >
            {save.isPending ? "שומר…" : saved ? "נשמר" : "שמירה"}
          </Button>
          <Button
            variant={approved ? "ghost" : "teal"}
            icon="check-circle"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({ status: approved ? "draft" : "approved" })
            }
          >
            {approved ? "החזרה לטיוטה" : "אישור ההצעה"}
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <FormError message={error} />
        </div>
      )}

      <div className="space-y-5">
        <Card className="p-4">
          <Label>כותרת</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Card>

        {/* Section 1 — customer journey */}
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold text-navy-800">
            מסלול הלקוח
          </div>
          <Textarea
            value={journey}
            onChange={(e) => setJourney(e.target.value)}
            placeholder="מהמפגש הראשון ועד סגירה — שלבי המסע של הלקוח."
            rows={4}
          />
        </Card>

        {/* Section 2 — channels */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-navy-800">
              ערוצי שיווק
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon="plus"
              onClick={() =>
                setChannels((cs) => [
                  ...cs,
                  { name: "", description: "", budget: "" },
                ])
              }
            >
              ערוץ
            </Button>
          </div>
          {channels.length === 0 ? (
            <p className="text-xs text-navy-400">
              הוסף ערוץ (למשל: אינסטגרם ממומן, גוגל, ניוזלטר) עם תיאור ותקציב.
            </p>
          ) : (
            <div className="space-y-2.5">
              {channels.map((c, i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-xl border border-navy-100 p-2.5 sm:grid-cols-[1fr_1.6fr_0.8fr_auto]"
                >
                  <Input
                    value={c.name}
                    onChange={(e) => setChannel(i, { name: e.target.value })}
                    placeholder="ערוץ"
                  />
                  <Input
                    value={c.description}
                    onChange={(e) =>
                      setChannel(i, { description: e.target.value })
                    }
                    placeholder="מה נעשה בו"
                  />
                  <Input
                    value={c.budget}
                    onChange={(e) => setChannel(i, { budget: e.target.value })}
                    placeholder="תקציב"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setChannels((cs) => cs.filter((_, j) => j !== i))
                    }
                    className="grid place-items-center rounded-lg px-2 text-navy-400 hover:bg-navy-50"
                    aria-label="הסרה"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 3 — budget */}
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold text-navy-800">תקציב</div>
          <Textarea
            value={budgetSummary}
            onChange={(e) => setBudgetSummary(e.target.value)}
            placeholder="פירוט התקציב, חלוקה, הנחות…"
            rows={3}
          />
          <div className="mt-3">
            <Label>סה״כ</Label>
            <Input
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder='למשל: ₪12,000 + מע״מ'
              className="w-56"
            />
          </div>
        </Card>

        <Card className="p-4">
          <Label>הערות</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="תנאים, תוקף ההצעה, הערות…"
            rows={2}
          />
        </Card>

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            icon="trash"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm("למחוק את הצעת המחיר?")) remove.mutate();
            }}
          >
            מחיקה
          </Button>
        </div>
      </div>
    </div>
  );
}

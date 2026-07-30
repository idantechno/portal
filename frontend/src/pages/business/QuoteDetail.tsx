import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  quotesApi,
  type Quote,
  type QuoteLineItem,
  type QuoteTemplate,
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

const TEMPLATES: { key: QuoteTemplate; label: string; hint: string }[] = [
  { key: "classic", label: "קלאסי", hint: "רקע בצבע הלוגו, פס מותג" },
  { key: "bold", label: "מודגש", hint: "רקע בצבע הלוגו, בלוק כותרת" },
  { key: "minimal", label: "מינימלי", hint: "רקע בצבע הלוגו, אוורירי" },
  { key: "editorial", label: "אלגנטי", hint: "רקע בצבע הלוגו, סריף" },
  { key: "emblem", label: "אמבלם", hint: "רקע בצבע הלוגו, לוגו במרכז" },
  { key: "sidebar", label: "פס-צד", hint: "מסמך לבן + סיידבר בצבע הלוגו" },
  { key: "strip", label: "רצועה", hint: "מסמך לבן + רצועה בצבע הלוגו" },
];

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
  return (
    <QuoteEditor key={quote.data.id} businessId={businessId} quote={quote.data} />
  );
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
  const [template, setTemplate] = useState<QuoteTemplate>(
    quote.template ?? "classic",
  );
  const [brief, setBrief] = useState("");
  const [intro, setIntro] = useState(quote.intro ?? "");
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>(
    quote.lineItems?.length ? quote.lineItems : [],
  );
  const [total, setTotal] = useState(quote.total ?? "");
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [phone, setPhone] = useState("");
  const [acting, setActing] = useState<"pdf" | "preview" | "wa" | null>(null);
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

  const draft = useMutation({
    mutationFn: () => quotesApi.draft(businessId, quoteId, brief.trim()),
    onSuccess: (d) => {
      if (!d) {
        setError("הניסוח לא הצליח. נסה שוב, או מלא ידנית.");
        return;
      }
      // Fill the form — prices stay empty for the operator to set.
      setIntro(d.intro || "");
      setLineItems(
        d.lineItems.length
          ? d.lineItems.map((it) => ({ ...it, amount: it.amount || "" }))
          : [],
      );
      if (d.terms) setNotes(d.terms);
      setError(null);
    },
    onError: (e) => setError(apiErrorMessage(e, "הניסוח נכשל")),
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
    template,
    intro,
    lineItems: lineItems
      .map((it) => ({
        name: it.name.trim(),
        description: it.description.trim(),
        amount: it.amount.trim(),
      }))
      .filter((it) => it.name || it.description || it.amount),
    total: total.trim(),
    notes: notes.trim(),
  });

  const setItem = (i: number, patch: Partial<QuoteLineItem>) =>
    setLineItems((items) =>
      items.map((it, j) => (j === i ? { ...it, ...patch } : it)),
    );

  // PDF/share act on the SAVED quote, so save the current form first.
  const saveThen = async (
    fn: () => Promise<void>,
    kind: "pdf" | "preview" | "wa",
  ) => {
    setActing(kind);
    setError(null);
    try {
      await save.mutateAsync(currentBody());
      await fn();
    } catch (e) {
      setError(apiErrorMessage(e, "הפעולה נכשלה"));
    } finally {
      setActing(null);
    }
  };

  const downloadPdf = () =>
    void saveThen(async () => {
      const blob = await quotesApi.pdf(businessId, quoteId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "הצעת-מחיר.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }, "pdf");

  const previewPdf = () => {
    // Open the tab synchronously (before await) so popup blockers allow it.
    const w = window.open("about:blank", "_blank");
    void saveThen(async () => {
      const blob = await quotesApi.pdf(businessId, quoteId);
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url;
      else window.open(url, "_blank");
    }, "preview");
  };

  const sendWhatsapp = () => {
    const digits = phone.replace(/\D/g, "");
    const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
    if (intl.length < 9) {
      setError("מספר טלפון לא תקין");
      return;
    }
    const w = window.open("about:blank", "_blank");
    void saveThen(async () => {
      const { publicUrl } = await quotesApi.share(businessId, quoteId);
      const msg = `הצעת מחיר — ${title.trim()}\n${publicUrl}`;
      const wa = `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
      if (w) w.location.href = wa;
      else window.open(wa, "_blank");
    }, "wa");
  };

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

        {/* Design picker — each template is auto-branded with the business colors + logo */}
        <Card className="p-4">
          <div className="mb-2.5 text-sm font-semibold text-navy-800">
            עיצוב המסמך
          </div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTemplate(t.key)}
                className={`rounded-xl border px-3 py-2 text-start transition-colors ${
                  template === t.key
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-navy-200 text-navy-600 hover:border-brand-300"
                }`}
              >
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-navy-400">{t.hint}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-navy-400">
            כל עיצוב מושך אוטומטית את הצבעים והלוגו של העסק. בחר, ואז "תצוגה
            מקדימה" למטה כדי לראות.
          </p>
        </Card>

        {/* AI draft — tailored to the business; accepts a brief OR pasted text */}
        <Card className="p-4 bg-brand-50/40">
          <div className="mb-1.5 text-sm font-semibold text-navy-800">
            ניסוח חכם לפי אופי העסק
          </div>
          <p className="mb-2.5 text-xs text-navy-400">
            כתוב במשפט מה אתה מתמחר — או הדבק כאן תוכן קיים (הצעה ישנה, מייל,
            רשימת שירותים) — והסוכן יבנה ממנו הצעה שמתאימה לעסק שלך. המחירים תמיד
            נשארים לך למילוי.
          </p>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="למשל: בניית אתר תדמית עם מערכת ניהול תוכן — או הדבק טקסט קיים"
            rows={3}
          />
          <div className="mt-2 flex justify-end">
            <Button
              icon="idea"
              disabled={brief.trim().length < 2 || draft.isPending}
              onClick={() => draft.mutate()}
            >
              {draft.isPending ? "מנסח…" : "נסח עם AI"}
            </Button>
          </div>
        </Card>

        {/* Scope */}
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold text-navy-800">
            היקף העבודה
          </div>
          <Textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="מה כולל הפרויקט / השירות — במשפט או שניים."
            rows={3}
          />
        </Card>

        {/* Line items */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-navy-800">פירוט</div>
            <Button
              size="sm"
              variant="ghost"
              icon="plus"
              onClick={() =>
                setLineItems((items) => [
                  ...items,
                  { name: "", description: "", amount: "" },
                ])
              }
            >
              פריט
            </Button>
          </div>
          {lineItems.length === 0 ? (
            <p className="text-xs text-navy-400">
              הוסף פריט (למשל: אפיון, עיצוב, פיתוח) עם תיאור ומחיר — או השתמש
              בניסוח החכם למעלה.
            </p>
          ) : (
            <div className="space-y-2.5">
              {lineItems.map((it, i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-xl border border-navy-100 p-2.5 sm:grid-cols-[1fr_1.6fr_0.8fr_auto]"
                >
                  <Input
                    value={it.name}
                    onChange={(e) => setItem(i, { name: e.target.value })}
                    placeholder="פריט"
                  />
                  <Input
                    value={it.description}
                    onChange={(e) =>
                      setItem(i, { description: e.target.value })
                    }
                    placeholder="מה כולל"
                  />
                  <Input
                    value={it.amount}
                    onChange={(e) => setItem(i, { amount: e.target.value })}
                    placeholder="מחיר"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setLineItems((items) => items.filter((_, j) => j !== i))
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

        {/* Terms / notes */}
        <Card className="p-4">
          <Label>תנאים והערות</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="תוקף ההצעה, שלבי תשלום, הערות…"
            rows={2}
          />
        </Card>

        {/* Document + send to client */}
        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold text-navy-800">
            מסמך ושליחה
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              icon="doc"
              disabled={acting !== null}
              onClick={previewPdf}
            >
              {acting === "preview" ? "מכין…" : "תצוגה מקדימה"}
            </Button>
            <Button
              variant="ghost"
              icon="download"
              disabled={acting !== null}
              onClick={downloadPdf}
            >
              {acting === "pdf" ? "מכין…" : "הורד PDF"}
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label>טלפון הלקוח</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-0000000"
              />
            </div>
            <Button
              variant="teal"
              icon="whatsapp"
              disabled={acting !== null || phone.replace(/\D/g, "").length < 9}
              onClick={sendWhatsapp}
            >
              {acting === "wa" ? "מכין…" : "שלח בוואטסאפ"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-navy-400">
            השמירה מתבצעת אוטומטית לפני כל פעולה. השליחה פותחת וואטסאפ עם הודעה
            ולינק להצעה — לחיצה על "שלח" בוואטסאפ תעביר אותה ללקוח.
          </p>
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

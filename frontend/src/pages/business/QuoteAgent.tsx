import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { quotesApi } from "../../api/quotes";
import { customersApi } from "../../api/customers";
import { apiErrorMessage } from "../../api/client";
import {
  Button,
  Card,
  EmptyState,
  FormError,
  Input,
  Label,
  Spinner,
} from "../../components/ui";
import { Icon } from "../../components/icons";

/**
 * The quote agent — builds marketing price quotes. A quote is attached to a
 * customer here and then surfaces among that customer's reports in the marketing
 * agent, and unlocks the campaign "הצעת מחיר" prerequisite once approved.
 */
export default function QuoteAgent({ businessId }: { businessId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");

  const agents = useQuery({
    queryKey: ["business", businessId, "agents"],
    queryFn: () => agentsApi.forBusiness(businessId),
    enabled: Boolean(businessId),
  });
  const customers = useQuery({
    queryKey: ["customers", businessId, "recent"],
    queryFn: () => customersApi.list(businessId, "recent"),
    enabled: Boolean(businessId),
  });
  const quotes = useQuery({
    queryKey: ["quotes", businessId],
    queryFn: () => quotesApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const create = useMutation({
    mutationFn: () =>
      quotesApi.create(businessId, customerId, {
        title: title.trim() || "הצעת מחיר",
      }),
    onSuccess: (quote) => {
      qc.invalidateQueries({ queryKey: ["quotes", businessId] });
      navigate(`/app/businesses/${businessId}/quotes/${quote.id}`);
    },
    onError: (e) => setError(apiErrorMessage(e, "יצירת הצעת המחיר נכשלה")),
  });

  const customerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers.data ?? [])
      map.set(c.id, c.businessName?.trim() || c.name);
    return map;
  }, [customers.data]);

  if (agents.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const entitled = (agents.data ?? []).some((a) => a.key === "quote");
  if (!entitled) {
    return <Navigate to={`/app/businesses/${businessId}/agents`} replace />;
  }

  const quoteList = quotes.data ?? [];
  const customerList = customers.data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Icon name="receipt" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">סוכן הצעות מחיר</h1>
            <p className="text-sm text-neutral-600">
              הצעת מחיר מותאמת ללקוח — הסוכן מנסח את המבנה וההיקף לפי אופי העסק
              שלך, ואתה קובע את המחירים. הצעה מאושרת נכנסת לתיקיית הלקוח.
            </p>
          </div>
        </div>
        <Button
          icon="plus"
          onClick={() => {
            setError(null);
            setCreating(true);
          }}
          disabled={customerList.length === 0}
        >
          הצעה חדשה
        </Button>
      </header>

      {error && (
        <div className="mb-4">
          <FormError message={error} />
        </div>
      )}

      {creating && (
        <Card className="mb-6 p-4">
          <div className="mb-3 text-sm font-medium text-navy-900">
            הצעת מחיר חדשה
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>לקוח</Label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">בחר לקוח…</option>
                {customerList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName?.trim() || c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>כותרת</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="למשל: הצעת מחיר — בניית אתר"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              ביטול
            </Button>
            <Button
              disabled={!customerId || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "יוצר…" : "צור והמשך למילוי"}
            </Button>
          </div>
        </Card>
      )}

      {customerList.length === 0 && (
        <Card className="mb-6 p-4 text-sm text-navy-500">
          כדי לבנות הצעת מחיר צריך קודם לקוח. אפשר להוסיף לקוח בסוכן השיווק (טאב
          לקוחות).
        </Card>
      )}

      {quoteList.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon="receipt"
            title="אין עדיין הצעות מחיר"
            text="צור הצעת מחיר חדשה ובחר לקוח."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {quoteList.map((q) => (
            <button
              key={q.id}
              onClick={() =>
                navigate(`/app/businesses/${businessId}/quotes/${q.id}`)
              }
              className="w-full text-start"
            >
              <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-e2)]">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                    q.status === "approved"
                      ? "bg-teal-50 text-teal-700 ring-teal-200"
                      : "bg-coral-50 text-coral-600 ring-coral-200"
                  }`}
                >
                  {q.status === "approved" ? "מאושרת" : "טיוטה"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-navy-900">
                    {q.title}
                  </div>
                  <div className="truncate text-xs text-neutral-500">
                    {customerName.get(q.customerId) ?? "לקוח"}
                    {q.total ? ` · ${q.total}` : ""}
                  </div>
                </div>
                <Icon
                  name="chevron-start"
                  size={16}
                  className="shrink-0 text-navy-300"
                />
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { businessesApi } from "../../api/businesses";
import { useAuthStore } from "../../store/auth";
import { isPlatformStaff } from "../../lib/roles";
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
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [title, setTitle] = useState("");

  const agents = useQuery({
    queryKey: ["business", businessId, "agents"],
    queryFn: () => agentsApi.forBusiness(businessId),
    enabled: Boolean(businessId),
  });
  // Operator = platform staff / entered via staff — may open any agent.
  const user = useAuthStore((s) => s.user);
  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });
  const isOperator =
    isPlatformStaff(user?.role) || (biz.data?.viaPlatformStaff ?? false);
  const customers = useQuery({
    queryKey: ["customers", businessId, "recent"],
    queryFn: () => customersApi.list(businessId, { sort: "recent" }),
    enabled: Boolean(businessId),
  });
  const quotes = useQuery({
    queryKey: ["quotes", businessId],
    queryFn: () => quotesApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const create = useMutation({
    mutationFn: () => {
      const input = { title: title.trim() || "הצעת מחיר" };
      if (mode === "new") {
        return quotesApi.createForRecipient(
          businessId,
          {
            recipientName: recipientName.trim(),
            recipientPhone: recipientPhone.trim() || undefined,
          },
          input,
        );
      }
      return quotesApi.create(businessId, customerId, input);
    },
    onSuccess: (quote) => {
      qc.invalidateQueries({ queryKey: ["quotes", businessId] });
      // A new recipient becomes a lead-stage person — refresh the people list.
      qc.invalidateQueries({ queryKey: ["customers", businessId] });
      navigate(`/app/businesses/${businessId}/quotes/${quote.id}`);
    },
    onError: (e) => setError(apiErrorMessage(e, "יצירת הצעת המחיר נכשלה")),
  });

  // Whether the form can be submitted in the current mode.
  const canSubmit =
    mode === "new" ? recipientName.trim().length > 0 : Boolean(customerId);

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
  const entitled = (agents.data ?? []).some(
    (a) => a.key === "quote" && a.entitled,
  );
  if (!entitled && !isOperator) {
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
            // Default to the "new recipient" mode when there are no customers
            // yet, so the very first quote can be issued to a phone number.
            setMode(customerList.length === 0 ? "new" : "existing");
            setCreating(true);
          }}
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

          {/* Recipient: an existing customer/lead, or a brand-new phone number
              that gets captured as a lead. */}
          <div className="mb-3 inline-flex rounded-xl bg-navy-50 p-1 text-sm">
            {(
              [
                { key: "existing", label: "לקוח / ליד קיים" },
                { key: "new", label: "נמען חדש (טלפון)" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                disabled={m.key === "existing" && customerList.length === 0}
                className={`rounded-lg px-3.5 py-1.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  mode === m.key
                    ? "bg-white text-navy-900 shadow-e1"
                    : "text-navy-500 hover:text-navy-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {mode === "existing" ? (
              <div>
                <Label>לקוח / ליד</Label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="">בחר…</option>
                  {customerList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName?.trim() || c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <Label>שם הנמען</Label>
                  <Input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="שם פרטי / שם העסק"
                  />
                </div>
                <div>
                  <Label>טלפון (אופציונלי)</Label>
                  <Input
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="050-0000000"
                    inputMode="tel"
                  />
                </div>
              </>
            )}
            <div>
              <Label>כותרת</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="למשל: הצעת מחיר — בניית אתר"
              />
            </div>
          </div>

          {mode === "new" && (
            <p className="mt-2 text-xs text-navy-400">
              הנמען יישמר אוטומטית כליד חדש. אם המספר כבר קיים במערכת — ההצעה
              תיקשר אליו בלי כפילות.
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              ביטול
            </Button>
            <Button
              disabled={!canSubmit || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "יוצר…" : "צור והמשך למילוי"}
            </Button>
          </div>
        </Card>
      )}

      {quoteList.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon="receipt"
            title="אין עדיין הצעות מחיר"
            text="צור הצעת מחיר חדשה — ללקוח קיים או ישירות למספר טלפון."
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

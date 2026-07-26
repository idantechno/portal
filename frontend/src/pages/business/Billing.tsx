import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../../api/billing";
import type { Invoice } from "../../api/billing";
import { apiErrorMessage } from "../../api/client";
import { billingKeys } from "../../lib/queryKeys";
import { Button, Card, Input, Spinner } from "../../components/ui";

const shekels = (cents: number) =>
  `₪${(cents / 100).toLocaleString("he-IL")}`;

const INVOICE_STATUS: Record<Invoice["status"], string> = {
  draft: "טיוטה",
  sent: "נשלחה",
  paid: "שולמה",
  void: "בוטלה",
};

export default function Billing() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showInvoice, setShowInvoice] = useState(false);
  const [paidShown, setPaidShown] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const canceled = searchParams.get("canceled") === "1";

  const plans = useQuery({
    queryKey: billingKeys.plans(businessId),
    queryFn: () => billingApi.plans(businessId),
    enabled: Boolean(businessId),
  });
  const sub = useQuery({
    queryKey: billingKeys.subscription(businessId),
    queryFn: () => billingApi.subscription(businessId),
    enabled: Boolean(businessId),
  });
  const invoices = useQuery({
    queryKey: billingKeys.invoices(businessId),
    queryFn: () => billingApi.invoices(businessId),
    enabled: Boolean(businessId),
  });

  const setPlanMut = useMutation({
    mutationFn: (code: string) => billingApi.setPlan(businessId, code),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: billingKeys.subscription(businessId) }),
  });
  const checkoutMut = useMutation({
    mutationFn: (code: string) => billingApi.checkout(businessId, code),
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (err) => {
      // Never fail silently — tell the owner what happened. The most common
      // case today is the GROW payment link not being set for this plan yet.
      const raw = apiErrorMessage(err, "");
      setCheckoutError(
        raw.includes("PAYMENT_NOT_CONFIGURED")
          ? "התשלום המקוון עדיין בהגדרה. נחזור אליך להשלמת השדרוג."
          : "אירעה תקלה בפתיחת התשלום. נסה שוב עוד רגע.",
      );
    },
  });
  const confirmMut = useMutation({
    mutationFn: (sessionId: string) =>
      billingApi.confirmCheckout(businessId, sessionId),
    onSuccess: () => {
      setPaidShown(true);
      qc.invalidateQueries({ queryKey: billingKeys.subscription(businessId) });
    },
  });

  // Returning from Stripe Checkout with a session id: confirm the payment once.
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      confirmMut.mutate(sessionId);
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissCanceled() {
    searchParams.delete("canceled");
    setSearchParams(searchParams, { replace: true });
  }

  function choosePlan(code: string, priceCents: number) {
    setCheckoutError(null);
    if (priceCents === 0) setPlanMut.mutate(code);
    else checkoutMut.mutate(code);
  }

  const markPaidMut = useMutation({
    mutationFn: (id: string) => billingApi.markPaid(businessId, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: billingKeys.invoices(businessId) }),
  });

  const currentPlan = sub.data?.planCode;
  const providers = plans.data?.providers ?? [];

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900 mb-1">חיוב ותשלומים</h1>
        <p className="text-navy-500 text-sm">
          המנוי שלך במערכת, וחשבוניות שאתה מפיק ללקוחות.
        </p>
      </header>

      {paidShown && (
        <div className="mb-6 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800 flex items-center justify-between">
          <span>התשלום בוצע והמנוי הופעל ✓</span>
          <button onClick={() => setPaidShown(false)} className="text-teal-600 hover:text-teal-800">✕</button>
        </div>
      )}
      {canceled && (
        <div className="mb-6 rounded-xl bg-navy-50 border border-navy-200 px-4 py-3 text-sm text-navy-600 flex items-center justify-between">
          <span>התשלום בוטל. לא בוצע חיוב.</span>
          <button onClick={dismissCanceled} className="text-navy-400 hover:text-navy-700">✕</button>
        </div>
      )}

      {/* Plans */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-brand-600 mb-3">המסלול שלך</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {(plans.data?.plans ?? []).map((plan) => {
            const active = currentPlan === plan.code;
            return (
              <Card
                key={plan.code}
                className={`p-5 flex flex-col ${active ? "border-brand-400 ring-2 ring-brand-100" : ""}`}
              >
                <div className="font-semibold text-navy-900">{plan.name}</div>
                <div className="text-2xl font-bold text-navy-900 my-2">
                  {plan.priceCents === 0 ? "חינם" : shekels(plan.priceCents)}
                  {plan.priceCents > 0 && (
                    <span className="text-sm font-normal text-navy-400">
                      {" "}
                      / חודש
                    </span>
                  )}
                </div>
                <ul className="text-xs text-navy-500 space-y-1 mb-4 flex-1">
                  {plan.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant={active ? "ghost" : "primary"}
                  disabled={
                    active || setPlanMut.isPending || checkoutMut.isPending
                  }
                  onClick={() => choosePlan(plan.code, plan.priceCents)}
                  className="w-full"
                >
                  {active
                    ? "המסלול הנוכחי"
                    : plan.priceCents === 0
                      ? "בחר מסלול"
                      : "שדרג ושלם"}
                </Button>
              </Card>
            );
          })}
        </div>
        {checkoutError && (
          <div className="mt-3 rounded-xl bg-coral-50 border border-coral-200 px-4 py-3 text-sm text-coral-800 flex items-center justify-between gap-3">
            <span>{checkoutError}</span>
            <button
              onClick={() => setCheckoutError(null)}
              className="text-coral-500 hover:text-coral-700 shrink-0"
              aria-label="סגור"
            >
              ✕
            </button>
          </div>
        )}
        {providers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">

            {providers.map((p) => (
              <span
                key={p.name}
                className={`text-xs px-2.5 py-1 rounded-full ${
                  p.configured
                    ? "bg-teal-100 text-teal-700"
                    : "bg-navy-100 text-navy-400"
                }`}
              >
                {p.label}: {p.configured ? "מחובר" : "דורש הגדרה"}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Invoices */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-brand-600">
            חשבוניות ללקוחות
          </h2>
          {!showInvoice && (
            <Button size="sm" onClick={() => setShowInvoice(true)}>
              + חשבונית
            </Button>
          )}
        </div>

        {showInvoice && (
          <InvoiceForm
            businessId={businessId}
            onDone={() => {
              setShowInvoice(false);
              qc.invalidateQueries({ queryKey: billingKeys.invoices(businessId) });
            }}
            onCancel={() => setShowInvoice(false)}
          />
        )}

        {invoices.data && invoices.data.length === 0 && !showInvoice && (
          <Card className="p-10 text-center text-navy-400 text-sm">
            אין חשבוניות עדיין.
          </Card>
        )}

        {invoices.data && invoices.data.length > 0 && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-cream-50 text-navy-400 text-xs">
                <tr>
                  <th className="text-start px-4 py-3">מספר</th>
                  <th className="text-start px-4 py-3">לקוח</th>
                  <th className="text-start px-4 py-3">סכום</th>
                  <th className="text-start px-4 py-3">סטטוס</th>
                  <th className="text-start px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {invoices.data.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                      {inv.number}
                    </td>
                    <td className="px-4 py-3">{inv.customerName ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">
                      {shekels(inv.amountCents)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          inv.status === "paid"
                            ? "bg-teal-100 text-teal-700"
                            : "bg-brand-100 text-brand-700"
                        }`}
                      >
                        {INVOICE_STATUS[inv.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      {inv.status !== "paid" && (
                        <button
                          onClick={() => markPaidMut.mutate(inv.id)}
                          className="text-xs text-brand-600 hover:text-brand-700"
                        >
                          סמן כשולמה
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

function InvoiceForm({
  businessId,
  onDone,
  onCancel,
}: {
  businessId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      billingApi.createInvoice(businessId, {
        customerName: customerName || undefined,
        lineItems: [
          {
            description,
            quantity: Number(quantity) || 1,
            unitPriceCents: Math.round((Number(unitPrice) || 0) * 100),
          },
        ],
      }),
    onSuccess: onDone,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (description.trim()) createMut.mutate();
  }

  return (
    <Card className="p-5 mb-4">
      <form onSubmit={submit} className="space-y-3">
        <Input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="שם הלקוח"
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="תיאור הפריט"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="כמות"
            dir="ltr"
          />
          <Input
            type="number"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="מחיר ליחידה (₪)"
            dir="ltr"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? <Spinner /> : "צור חשבונית"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            ביטול
          </Button>
        </div>
      </form>
    </Card>
  );
}

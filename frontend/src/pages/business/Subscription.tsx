import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../../api/billing";
import { apiErrorMessage } from "../../api/client";
import { billingKeys } from "../../lib/queryKeys";
import {
  Badge,
  Banner,
  Button,
  Card,
  PageHeader,
} from "../../components/ui";

const shekels = (cents: number) =>
  `₪${(cents / 100).toLocaleString("he-IL")}`;

/**
 * The owner's own subscription to Portal Studio — current plan, the plan
 * picker, and checkout. Client-visible (not gated behind the operator-only
 * settings). Formerly the top half of the Billing screen; the logic
 * (checkout/confirm, canceled banner, revenue-scaled upsell entry) is intact.
 */
export default function Subscription() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Returning from Checkout with a session id: confirm the payment once.
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

  function choosePlan(code: string) {
    // Every plan is paid now, so choosing one always opens checkout.
    setCheckoutError(null);
    checkoutMut.mutate(code);
  }

  const currentPlan = sub.data?.planCode;
  const providers = plans.data?.providers ?? [];

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
      <PageHeader
        title="המנוי שלי"
        subtitle="המסלול שלך ב-Portal Studio — שדרג או שנה בכל עת."
      />

      {paidShown && (
        <Banner
          tone="success"
          className="mb-6"
          onDismiss={() => setPaidShown(false)}
        >
          התשלום בוצע והמנוי הופעל
        </Banner>
      )}
      {canceled && (
        <Banner tone="info" className="mb-6" onDismiss={dismissCanceled}>
          התשלום בוטל. לא בוצע חיוב.
        </Banner>
      )}

      <section>
        <h2 className="text-sm font-semibold text-brand-600 mb-3">המסלול שלך</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {(plans.data?.plans ?? []).map((plan) => {
            const active = currentPlan === plan.code;
            return (
              <Card
                key={plan.code}
                className={`p-5 flex flex-col ${active ? "border-brand-400 ring-2 ring-brand-100" : ""}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-navy-900">
                    {plan.name}
                  </span>
                  <span className="text-xs text-navy-400" dir="ltr">
                    {plan.nameEn}
                  </span>
                </div>
                <p className="text-xs text-navy-500 mt-1 min-h-[2.5rem]">
                  {plan.tagline}
                </p>
                <div className="text-2xl font-bold text-navy-900 my-2">
                  {shekels(plan.priceCents)}
                  <span className="text-sm font-normal text-navy-400">
                    {" "}
                    / חודש
                  </span>
                </div>
                <ul className="text-xs text-navy-500 space-y-1 mb-4 flex-1">
                  {plan.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant={active ? "ghost" : "primary"}
                  disabled={active || checkoutMut.isPending}
                  onClick={() => choosePlan(plan.code)}
                  className="w-full"
                >
                  {active ? "המסלול הנוכחי" : "בחר מסלול"}
                </Button>
              </Card>
            );
          })}
        </div>
        {checkoutError && (
          <Banner
            tone="danger"
            className="mt-3"
            onDismiss={() => setCheckoutError(null)}
          >
            {checkoutError}
          </Banner>
        )}
        {providers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {providers.map((p) => (
              <Badge key={p.name} tone={p.configured ? "teal" : "neutral"}>
                {p.label}: {p.configured ? "מחובר" : "דורש הגדרה"}
              </Badge>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

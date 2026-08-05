import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../../../api/billing";
import type { Invoice } from "../../../api/billing";
import { billingKeys } from "../../../lib/queryKeys";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Spinner,
} from "../../../components/ui";
import type { BadgeTone } from "../../../components/ui";

const shekels = (cents: number) =>
  `₪${(cents / 100).toLocaleString("he-IL")}`;

const INVOICE_STATUS: Record<Invoice["status"], string> = {
  draft: "טיוטה",
  sent: "נשלחה",
  paid: "שולמה",
  void: "בוטלה",
};
const INVOICE_STATUS_TONE: Record<Invoice["status"], BadgeTone> = {
  draft: "neutral",
  sent: "brand",
  paid: "success",
  void: "warning",
};

/**
 * The owner's customer-invoices surface (income) — create an invoice, mark it
 * paid, watch the status. Content only; the כסף page owns the header + tabs.
 */
export default function IncomeSection({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const [showInvoice, setShowInvoice] = useState(false);

  const invoices = useQuery({
    queryKey: billingKeys.invoices(businessId),
    queryFn: () => billingApi.invoices(businessId),
    enabled: Boolean(businessId),
  });

  const markPaidMut = useMutation({
    mutationFn: (id: string) => billingApi.markPaid(businessId, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: billingKeys.invoices(businessId) }),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-brand-600">
          חשבוניות ללקוחות
        </h2>
        {!showInvoice && (
          <Button size="sm" icon="plus" onClick={() => setShowInvoice(true)}>
            חשבונית
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
        <Card>
          <EmptyState
            icon="receipt"
            title="אין חשבוניות עדיין"
            text="הפק את החשבונית הראשונה שלך ללקוח — היא תופיע כאן."
            action={
              <Button icon="plus" onClick={() => setShowInvoice(true)}>
                צור חשבונית ראשונה
              </Button>
            }
          />
        </Card>
      )}

      {invoices.data && invoices.data.length > 0 && (
        <Card className="divide-y divide-navy-50 overflow-hidden">
          {invoices.data.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
            >
              <span className="font-mono text-xs text-navy-500 shrink-0" dir="ltr">
                {inv.number}
              </span>
              <div className="min-w-0 flex-1 text-sm text-navy-800 truncate">
                {inv.customerName ?? "—"}
              </div>
              <span className="text-sm font-medium text-navy-900 shrink-0">
                {shekels(inv.amountCents)}
              </span>
              <Badge tone={INVOICE_STATUS_TONE[inv.status]} className="shrink-0">
                {INVOICE_STATUS[inv.status]}
              </Badge>
              {inv.status !== "paid" && (
                <button
                  onClick={() => markPaidMut.mutate(inv.id)}
                  className="text-xs text-brand-600 hover:text-brand-700 shrink-0"
                >
                  סמן כשולמה
                </button>
              )}
            </div>
          ))}
        </Card>
      )}
    </section>
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

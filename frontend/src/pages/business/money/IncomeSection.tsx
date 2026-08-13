import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../../../api/billing";
import type { Invoice } from "../../../api/billing";
import { billingKeys } from "../../../lib/queryKeys";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  IconTile,
  Input,
  Spinner,
} from "../../../components/ui";
import type { BadgeTone } from "../../../components/ui";
import { Icon } from "../../../components/icons";

const shekels = (cents: number) =>
  `₪${(cents / 100).toLocaleString("he-IL")}`;

function countLabel(n: number): string {
  return n === 1 ? "חשבונית אחת" : `${n} חשבוניות`;
}

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
 * The owner's customer-invoices surface (income). Same two-zone contrast as the
 * expenses tab: a brand-tinted "הוספה" card where an invoice is *created*, then
 * a white card that only *lists* what already exists. Content only; the כסף
 * page owns the header + tabs.
 */
export default function IncomeSection({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const [showInvoice, setShowInvoice] = useState(false);

  const invoices = useQuery({
    queryKey: billingKeys.invoices(businessId),
    queryFn: () => billingApi.invoices(businessId),
    enabled: Boolean(businessId),
  });

  const [payError, setPayError] = useState<string | null>(null);
  const markPaidMut = useMutation({
    mutationFn: (id: string) => billingApi.markPaid(businessId, id),
    onSuccess: () => {
      setPayError(null);
      qc.invalidateQueries({ queryKey: billingKeys.invoices(businessId) });
    },
    onError: () =>
      setPayError(
        "לא הצלחנו להפיק את המסמך החוקי בחשבונית ירוקה. החשבונית לא סומנה כשולמה — נסה שוב.",
      ),
  });

  const rows = invoices.data ?? [];
  const count = rows.length;

  return (
    <div className="space-y-6">
      {/* ── INPUT: create an invoice ─────────────────────────────────────
          Brand-tinted so it reads as the one place data goes IN, distinct
          from the white list below. */}
      <Card className="border border-brand-100 bg-brand-50/40 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <IconTile icon="receipt" tone="brand" />
          <div className="min-w-0 flex-1">
            <div className="eyebrow text-brand-500 mb-0.5">הוספה</div>
            <h2 className="font-display text-lg text-navy-900">
              הפקת חשבונית ללקוח
            </h2>
            <p className="text-sm text-navy-500 mt-0.5">
              צור חשבונית חדשה — היא תתווסף לרשימה למטה ותיכנס להכנסות החודש
              כשתסמן אותה כשולמה. אם חשבונית ירוקה מחוברת, הסימון כ"שולמה" גם מפיק
              את המסמך החוקי (קבלה או חשבונית מס) אצל הלקוח.
            </p>
            {!showInvoice && (
              <Button
                className="mt-4"
                icon="plus"
                onClick={() => setShowInvoice(true)}
              >
                חשבונית חדשה
              </Button>
            )}
          </div>
        </div>

        {showInvoice && (
          <div className="mt-5 border-t border-brand-100 pt-5">
            <InvoiceForm
              businessId={businessId}
              onDone={() => {
                setShowInvoice(false);
                qc.invalidateQueries({
                  queryKey: billingKeys.invoices(businessId),
                });
              }}
              onCancel={() => setShowInvoice(false)}
            />
          </div>
        )}
      </Card>

      {/* ── VIEW: the invoices, listed ───────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-5 pb-4 sm:p-6 sm:pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <IconTile icon="doc" tone="secondary" size="sm" />
            <h3 className="font-display text-lg text-navy-900">
              החשבוניות שלי
            </h3>
          </div>
          {count > 0 && (
            <span className="text-[11px] text-navy-400 shrink-0">
              {countLabel(count)}
            </span>
          )}
        </div>

        {payError && (
          <div className="px-5 pb-4 sm:px-6">
            <Banner tone="danger">{payError}</Banner>
          </div>
        )}

        {invoices.isLoading ? (
          <div className="flex justify-center border-t border-navy-100 py-8">
            <Spinner />
          </div>
        ) : count === 0 ? (
          <div className="border-t border-navy-100">
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
          </div>
        ) : (
          <div className="border-t border-navy-100 divide-y divide-navy-50">
            {rows.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 sm:px-6"
              >
                <span
                  className="font-mono text-xs text-navy-500 shrink-0"
                  dir="ltr"
                >
                  {inv.number}
                </span>
                <div className="min-w-0 flex-1 text-sm text-navy-800 truncate">
                  {inv.customerName ?? "—"}
                </div>
                <span className="text-sm font-medium text-navy-900 shrink-0">
                  {shekels(inv.amountCents)}
                </span>
                <Badge
                  tone={INVOICE_STATUS_TONE[inv.status]}
                  className="shrink-0"
                >
                  {INVOICE_STATUS[inv.status]}
                </Badge>
                {inv.pdfUrl && (
                  <a
                    href={inv.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 shrink-0"
                  >
                    <Icon name="external" size={13} />
                    מסמך חוקי
                    {inv.externalDocNumber ? ` ${inv.externalDocNumber}` : ""}
                  </a>
                )}
                {inv.status !== "paid" && (
                  <button
                    onClick={() => markPaidMut.mutate(inv.id)}
                    disabled={markPaidMut.isPending}
                    className="text-xs text-brand-600 hover:text-brand-700 shrink-0 disabled:opacity-50"
                  >
                    סמן כשולמה
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
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
  );
}

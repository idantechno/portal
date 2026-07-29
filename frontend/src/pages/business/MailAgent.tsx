import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mailApi, type MailItem, type MailItemStatus } from "../../api/mail";
import { apiErrorMessage } from "../../api/client";
import { Button, Card, EmptyState, FormError, Spinner } from "../../components/ui";

const TABS: { key: MailItemStatus; label: string }[] = [
  { key: "pending", label: "ממתין לאישור" },
  { key: "approved", label: "אושרו" },
  { key: "dismissed", label: "נדחו" },
];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ItemCard({
  item,
  businessId,
  onError,
}: {
  item: MailItem;
  businessId: string;
  onError: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["mail-items", businessId] });

  const approve = useMutation({
    mutationFn: () => mailApi.approve(businessId, item.id),
    onSuccess: () => void invalidate(),
    onError: (e) => onError(apiErrorMessage(e, "האישור נכשל.")),
  });
  const dismiss = useMutation({
    mutationFn: () => mailApi.dismiss(businessId, item.id),
    onSuccess: () => void invalidate(),
    onError: (e) => onError(apiErrorMessage(e, "הפעולה נכשלה.")),
  });
  const busy = approve.isPending || dismiss.isPending;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-navy-800 truncate">
            {item.subject || "(ללא נושא)"}
          </div>
          <div className="text-xs text-navy-400 mt-0.5 truncate">
            {item.fromAddress} · {formatWhen(item.receivedAt)}
          </div>
        </div>
        {item.hasAttachment && (
          <span className="shrink-0 rounded-full bg-brand-50 text-brand-600 text-xs px-2 py-0.5">
            {item.attachmentName || "קובץ מצורף"}
          </span>
        )}
      </div>

      {item.snippet && (
        <p className="text-sm text-navy-500 line-clamp-2">{item.snippet}</p>
      )}

      {item.status === "pending" ? (
        <div className="flex items-center gap-2 pt-1">
          <Button onClick={() => approve.mutate()} disabled={busy}>
            {approve.isPending ? <Spinner /> : "אשר → הוצאה"}
          </Button>
          <button
            type="button"
            onClick={() => dismiss.mutate()}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm text-navy-500 hover:bg-navy-50 disabled:opacity-50"
          >
            דחה
          </button>
        </div>
      ) : (
        <div className="text-xs text-navy-400">
          {item.status === "approved"
            ? item.expenseId
              ? "אושר ונכנס כהוצאה"
              : "אושר"
            : "נדחה"}
        </div>
      )}
    </Card>
  );
}

export default function MailAgent({ businessId }: { businessId: string }) {
  const [tab, setTab] = useState<MailItemStatus>("pending");
  const [error, setError] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ["mail-items", businessId, tab],
    queryFn: () => mailApi.list(businessId, tab),
    enabled: Boolean(businessId),
  });

  const rows = items.data ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl text-navy-900">סוכן מייל</h1>
        <p className="text-sm text-navy-400 mt-1">
          סורק את תיבת המייל, מזהה חשבוניות וקבלות ומביא אותן לאישור שלך — כלום
          לא נכנס למערכת בלי שתאשר.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
              tab === t.key
                ? "bg-brand-500 border-brand-500 text-white"
                : "bg-white border-navy-200 text-navy-600 hover:border-brand-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FormError message={error} />

      {items.isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="mail"
          title={tab === "pending" ? "אין פריטים לאישור" : "אין פריטים"}
          text={
            tab === "pending"
              ? "כשהסוכן יזהה חשבונית או קבלה חדשה במייל, היא תופיע כאן לאישור."
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              businessId={businessId}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

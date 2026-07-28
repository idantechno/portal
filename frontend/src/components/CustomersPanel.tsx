import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customersApi,
  type Customer,
  type CustomerSort,
} from "../api/customers";
import { apiErrorMessage } from "../api/client";
import {
  Button,
  Card,
  EmptyState,
  FormError,
  Input,
  Label,
  Spinner,
  Textarea,
} from "./ui";
import { Icon } from "./icons";

const SORTS: { key: CustomerSort; label: string }[] = [
  { key: "recent", label: "רישום אחרון" },
  { key: "alpha", label: "א-ב" },
  { key: "next_activity", label: "פעילות קרובה" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * The customers list + sort + "new customer" flow. Shared verbatim between the
 * sidebar "לקוחות" page and the marketing agent's customers tab — one list of
 * customers, surfaced in both places.
 */
export default function CustomersPanel({ businessId }: { businessId: string }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<CustomerSort>("recent");
  const [creating, setCreating] = useState(false);

  const customers = useQuery({
    queryKey: ["customers", businessId, sort],
    queryFn: () => customersApi.list(businessId, sort),
    enabled: Boolean(businessId),
  });

  const items = customers.data ?? [];
  const displayName = (c: Customer) => c.businessName?.trim() || c.name;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        {items.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-400">מיון:</span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  sort === s.key
                    ? "bg-brand-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <Button icon="plus" size="sm" onClick={() => setCreating(true)}>
          לקוח חדש
        </Button>
      </div>

      {customers.isLoading && (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      )}

      {!customers.isLoading && items.length === 0 && (
        <Card className="p-10">
          <EmptyState
            icon="users"
            title="אין עדיין לקוחות"
            text="הוסף לקוח חדש, או המר ליד ללקוח מטאב הלידים."
          />
        </Card>
      )}

      <div className="space-y-2">
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() =>
              navigate(`/app/businesses/${businessId}/customers/${c.id}`)
            }
            className="w-full text-start"
          >
            <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-e2)]">
              <div className="shrink-0 rounded-xl bg-teal-50 p-2 text-teal-700">
                <Icon name="user" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {displayName(c)}
                </div>
                <div className="truncate text-xs text-neutral-500">
                  {c.businessName && c.name !== c.businessName
                    ? `${c.name} · `
                    : ""}
                  {c.phone ? <span dir="ltr">{c.phone}</span> : "לקוח"}
                </div>
              </div>
              {c.nextActivityAt ? (
                <span className="shrink-0 text-[11px] text-amber-600">
                  {c.nextActivityNote ? `${c.nextActivityNote} · ` : ""}
                  {fmtDate(c.nextActivityAt)}
                </span>
              ) : (
                <span className="shrink-0 text-[11px] text-neutral-400">
                  {fmtDate(c.becameCustomerAt)}
                </span>
              )}
              <Icon
                name="chevron-end"
                size={16}
                className="shrink-0 text-neutral-300"
              />
            </Card>
          </button>
        ))}
      </div>

      {creating && (
        <CreateCustomerModal
          businessId={businessId}
          onClose={() => setCreating(false)}
          onCreated={(customer) => {
            setCreating(false);
            navigate(`/app/businesses/${businessId}/customers/${customer.id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateCustomerModal({
  businessId,
  onClose,
  onCreated,
}: {
  businessId: string;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      customersApi.create(businessId, {
        name: name.trim(),
        businessName: businessName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (customer) => {
      qc.invalidateQueries({ queryKey: ["customers", businessId] });
      onCreated(customer);
    },
    onError: (e) => setError(apiErrorMessage(e, "יצירת הלקוח נכשלה")),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-navy-100 bg-white px-5 py-4">
          <h2 className="text-lg font-bold text-navy-900">לקוח חדש</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50"
            aria-label="סגירה"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        <form
          className="space-y-3.5 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!name.trim()) {
              setError("צריך לפחות שם");
              return;
            }
            create.mutate();
          }}
        >
          <div>
            <Label>שם איש קשר *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם מלא"
              autoFocus
            />
          </div>
          <div>
            <Label>שם העסק</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="שם העסק של הלקוח"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>טלפון</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05x-xxxxxxx"
                dir="ltr"
              />
            </div>
            <div>
              <Label>אימייל</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                dir="ltr"
              />
            </div>
          </div>
          <div>
            <Label>הערות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הקשר, סיכומים, מה שחשוב לזכור…"
              rows={3}
            />
          </div>

          {error && <FormError message={error} />}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <>
                  <Spinner /> יוצר…
                </>
              ) : (
                "צור לקוח"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

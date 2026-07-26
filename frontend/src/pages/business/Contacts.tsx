import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  contactsApi,
  type ContactListItem,
  type ContactStatus,
} from "../../api/conversations";
import { leadsApi } from "../../api/leads";
import { Card, EmptyState } from "../../components/ui";
import { Icon } from "../../components/icons";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

const COPY: Record<
  ContactStatus,
  { title: string; subtitle: string; empty: string; icon: "leads" | "user" }
> = {
  lead: {
    title: "לידים",
    subtitle: "אנשים שהתעניינו או השאירו פרטים — עדיין לא לקוחות משלמים.",
    empty: "אין לידים עדיין. פניות חדשות שיסומנו כליד יופיעו כאן.",
    icon: "leads",
  },
  customer: {
    title: "לקוחות",
    subtitle: "הלקוחות המשלמים שלך. הסוכן מזהה אותם ומדבר איתם אישית.",
    empty: "אין לקוחות מסומנים עדיין. סמן מספר כ'לקוח' והוא יופיע כאן.",
    icon: "user",
  },
};

export default function Contacts() {
  const { businessId = "", status = "lead" } = useParams<{
    businessId: string;
    status: ContactStatus;
  }>();
  const navigate = useNavigate();
  const st: ContactStatus = status === "customer" ? "customer" : "lead";
  const copy = COPY[st];

  const contacts = useQuery({
    queryKey: ["contacts", businessId, st],
    queryFn: () => contactsApi.list(businessId, st),
    enabled: Boolean(businessId),
  });

  // Merge captured-lead detail (interest) into the leads view, keyed by contact.
  const leads = useQuery({
    queryKey: ["leads", businessId],
    queryFn: () => leadsApi.list(businessId),
    enabled: Boolean(businessId) && st === "lead",
  });
  const interestByContact = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of leads.data ?? []) {
      if (l.customerContactId && !map.has(l.customerContactId)) {
        map.set(l.customerContactId, l.interest);
      }
    }
    return map;
  }, [leads.data]);

  const items = contacts.data ?? [];

  const label = (c: ContactListItem) =>
    c.displayName?.trim() || c.phone || c.externalId;

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">{copy.title}</h1>
        <p className="text-neutral-600 text-sm">{copy.subtitle}</p>
      </header>

      {contacts.isLoading && (
        <div className="text-neutral-500 text-sm">טוען…</div>
      )}

      {!contacts.isLoading && items.length === 0 && (
        <Card className="p-10">
          <EmptyState icon={copy.icon} title={copy.title} text={copy.empty} />
        </Card>
      )}

      <div className="space-y-2">
        {items.map((c) => {
          const interest = interestByContact.get(c.id);
          return (
            <button
              key={c.id}
              onClick={() =>
                navigate(`/app/businesses/${businessId}/contacts/${st}/${c.id}`)
              }
              className="w-full text-start"
            >
              <Card className="p-3 flex items-center gap-3 hover:shadow-[var(--shadow-e2)] transition-shadow">
                <div
                  className={`rounded-xl p-2 shrink-0 ${
                    st === "customer"
                      ? "bg-teal-50 text-teal-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <Icon name={st === "customer" ? "user" : "leads"} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {label(c)}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    <span dir="ltr">{c.phone || c.externalId}</span>
                    {interest ? ` · ${interest}` : ""}
                  </div>
                </div>
                {c.lastActivityAt && (
                  <span className="text-[11px] text-neutral-400 shrink-0">
                    {timeAgo(c.lastActivityAt)}
                  </span>
                )}
                <Icon
                  name="chevron-end"
                  size={16}
                  className="text-neutral-300 shrink-0"
                />
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}

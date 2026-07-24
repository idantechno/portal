import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { briefsApi, type Brief } from "../../api/briefs";
import { Card, EmptyState } from "../../components/ui";
import { Icon } from "../../components/icons";

export default function Briefs() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const briefs = useQuery({
    queryKey: ["briefs", businessId],
    queryFn: () => briefsApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const items = briefs.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <h1 className="mb-1 text-2xl font-bold">בריפים</h1>
        <p className="text-sm text-neutral-600">
          מסמך מקור-אמת לכל עסק, שנבנה אוטומטית משאלון האסטרטגיה. שדות 🟠 הם
          טיוטה שדורשת אישור שלך לפני שימוש.
        </p>
      </header>

      {briefs.isLoading && (
        <div className="text-sm text-neutral-500">טוען…</div>
      )}

      {!briefs.isLoading && items.length === 0 && (
        <Card>
          <EmptyState
            icon="compass"
            title="עדיין אין בריפים"
            text="כדי להפיק בריף — היכנס למסך הלידים, פתח ליד שהגיע משאלון האסטרטגיה ולחץ «הפק בריף»."
          />
        </Card>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((brief) => (
            <BriefRow key={brief.id} brief={brief} businessId={businessId} />
          ))}
        </div>
      )}
    </div>
  );
}

function BriefRow({
  brief,
  businessId,
}: {
  brief: Brief;
  businessId: string;
}) {
  const approved = brief.status === "approved";
  return (
    <Link to={`/app/businesses/${businessId}/briefs/${brief.id}`}>
      <Card className="p-4 transition-shadow hover:shadow-[var(--shadow-e2)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-navy-900">
                {brief.title}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                  approved
                    ? "bg-teal-50 text-teal-700 ring-teal-200"
                    : "bg-coral-50 text-coral-600 ring-coral-200"
                }`}
              >
                {approved ? "מאושר" : "טיוטה"}
              </span>
              {brief.edited && (
                <span className="inline-flex items-center rounded-full bg-navy-50 px-2.5 py-0.5 text-xs text-navy-600 ring-1 ring-navy-100">
                  נערך ידנית
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-navy-400" dir="ltr">
              {brief.websiteUrl ?? "ללא סריקת אתר"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs text-navy-400" dir="ltr">
              {new Date(brief.updatedAt).toLocaleDateString("he-IL")}
            </span>
            <Icon name="chevron-start" size={18} />
          </div>
        </div>
      </Card>
    </Link>
  );
}

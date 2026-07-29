import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  aiUpdatesApi,
  type AiUpdate,
  type AiUpdateScope,
} from "../../api/aiUpdates";
import { apiErrorMessage } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { isSuperAdmin } from "../../lib/roles";
import { Button, Card, EmptyState, FormError, Spinner } from "../../components/ui";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function UpdateCard({ update }: { update: AiUpdate }) {
  return (
    <Card className="p-5 space-y-4">
      <div>
        <div className="text-xs text-navy-400">
          {formatDate(update.createdAt)}
        </div>
        <h3 className="font-display text-lg text-navy-800 mt-0.5">
          {update.title}
        </h3>
      </div>

      {update.summary && (
        <p className="text-sm text-navy-600 whitespace-pre-line leading-relaxed">
          {update.summary}
        </p>
      )}

      {update.items.length > 0 && (
        <ul className="space-y-3">
          {update.items.map((item, i) => (
            <li key={i} className="border-r-2 border-brand-200 pr-3">
              <div className="text-sm font-medium text-navy-800">
                {item.headline}
              </div>
              {item.detail && (
                <div className="text-sm text-navy-500 mt-0.5">
                  {item.detail}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {update.sources.length > 0 && (
        <div className="pt-3 border-t border-navy-100">
          <div className="text-xs text-navy-400 mb-1.5">מקורות</div>
          <ul className="space-y-1">
            {update.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-600 hover:underline break-all"
                >
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function AiUpdatesAgent({
  businessId,
}: {
  businessId: string;
}) {
  const qc = useQueryClient();
  const admin = isSuperAdmin(useAuthStore((s) => s.user)?.role);
  const [view, setView] = useState<AiUpdateScope>("business");
  const [error, setError] = useState<string | null>(null);

  const feed = useQuery({
    queryKey: ["ai-updates", view, businessId],
    queryFn: () =>
      view === "internal"
        ? aiUpdatesApi.internal()
        : aiUpdatesApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const generate = useMutation({
    mutationFn: (scope: AiUpdateScope) => aiUpdatesApi.generate(scope),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["ai-updates"] });
    },
    onError: (err) => setError(apiErrorMessage(err, "יצירת העדכון נכשלה.")),
  });

  const updates = feed.data ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl text-navy-900">עדכוני AI</h1>
        <p className="text-sm text-navy-400 mt-1">
          תקציר יומי של חדשות וכלי AI שימושיים לעסק שלך.
        </p>
      </div>

      {admin && (
        <Card className="p-4 space-y-3 bg-brand-50/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView("business")}
              className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                view === "business"
                  ? "bg-brand-500 border-brand-500 text-white"
                  : "bg-white border-navy-200 text-navy-600 hover:border-brand-300"
              }`}
            >
              עסקי · יומי
            </button>
            <button
              type="button"
              onClick={() => setView("internal")}
              className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                view === "internal"
                  ? "bg-brand-500 border-brand-500 text-white"
                  : "bg-white border-navy-200 text-navy-600 hover:border-brand-300"
              }`}
            >
              פנימי · Claude · שבועי
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => generate.mutate(view)}
              disabled={generate.isPending}
            >
              {generate.isPending ? <Spinner /> : "צור עדכון עכשיו"}
            </Button>
            <span className="text-xs text-navy-400">
              כלי בדיקה — מחפש ומנסח מיד
            </span>
          </div>
          <FormError message={error} />
        </Card>
      )}

      {feed.isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : updates.length === 0 ? (
        <EmptyState
          icon="news"
          title="אין עדכונים עדיין"
          text="העדכון הבא ייווצר אוטומטית. הסוכן מחפש כל יום מה חדש ושימושי בעולם ה-AI."
        />
      ) : (
        <div className="space-y-4">
          {updates.map((u) => (
            <UpdateCard key={u.id} update={u} />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadsApi, type Lead } from "../../api/leads";
import { privacyApi } from "../../api/privacy";
import { apiErrorMessage } from "../../api/client";
import { Button, Card, Spinner } from "../../components/ui";
import { Icon } from "../../components/icons";

export default function Leads() {
  const { t, i18n } = useTranslation();
  const { businessId = "" } = useParams<{ businessId: string }>();
  const [active, setActive] = useState<Lead | null>(null);
  const qc = useQueryClient();
  const leads = useQuery({
    queryKey: ["leads", businessId],
    queryFn: () => leadsApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const items = leads.data ?? [];

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">{t("leads.title")}</h1>
        <p className="text-neutral-600 text-sm">{t("leads.subtitle")}</p>
      </header>

      {leads.isLoading && (
        <div className="text-neutral-500 text-sm">{t("common.loading")}</div>
      )}
      {items.length === 0 && !leads.isLoading && (
        <Card className="p-12 text-center text-neutral-500">
          {t("leads.empty")}
        </Card>
      )}
      {items.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-start px-4 py-3">{t("leads.name")}</th>
                <th className="text-start px-4 py-3">מקור</th>
                <th className="text-start px-4 py-3">{t("leads.phone")}</th>
                <th className="text-start px-4 py-3">{t("leads.email")}</th>
                <th className="text-start px-4 py-3">{t("leads.interest")}</th>
                <th className="text-start px-4 py-3">{t("leads.createdAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((l) => {
                const isQ = l.source === "questionnaire";
                return (
                  <tr
                    key={l.id}
                    onClick={() => isQ && setActive(l)}
                    className={`hover:bg-neutral-50 ${isQ ? "cursor-pointer" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium">{l.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                          isQ
                            ? "bg-brand-50 text-brand-700 ring-brand-200"
                            : "bg-teal-50 text-teal-700 ring-teal-200"
                        }`}
                      >
                        {l.sourceDetail ?? (isQ ? "שאלון" : "צ׳אט")}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                      {l.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                      {l.email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {l.interest}
                      {isQ && (
                        <span className="ms-2 inline-flex items-center gap-1 text-xs text-brand-600">
                          צפייה בשאלון
                          <Icon name="arrow-end" size={13} />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs" dir="ltr">
                      {new Date(l.createdAt).toLocaleString(
                        i18n.language === "he" ? "he-IL" : "en-US",
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {active && (
        <QuestionnaireModal
          lead={active}
          businessId={businessId}
          onClose={() => setActive(null)}
          onErased={() => {
            qc.invalidateQueries({ queryKey: ["leads", businessId] });
            setActive(null);
          }}
        />
      )}
    </div>
  );
}

function QuestionnaireModal({
  lead,
  businessId,
  onClose,
  onErased,
}: {
  lead: Lead;
  businessId: string;
  onClose: () => void;
  onErased: () => void;
}) {
  const a = lead.answers ?? {};
  const sections = a.sections ?? [];
  const [confirmErase, setConfirmErase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const erase = useMutation({
    mutationFn: () => privacyApi.eraseLead(businessId, lead.id),
    onSuccess: onErased,
    onError: (e) => setError(apiErrorMessage(e, "המחיקה נכשלה")),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-navy-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-navy-900">{lead.name}</h2>
            <p className="text-sm text-navy-500">{lead.interest}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50"
            aria-label="סגירה"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        <div className="px-5 py-4">
          <dl className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-brand-50/60 p-3.5 text-sm">
            <Meta label="טלפון" value={lead.phone} ltr />
            <Meta label="אימייל" value={lead.email} ltr />
            <Meta label="ערוץ מועדף" value={channelLabel(a.preferredChannel)} />
          </dl>

          {sections.length === 0 && (
            <p className="text-sm text-navy-400">אין תשובות מפורטות.</p>
          )}
          <div className="space-y-5">
            {sections.map((section, i) => (
              <div key={i}>
                <h3 className="mb-2 text-sm font-semibold text-brand-700">
                  {section.title}
                </h3>
                <dl className="space-y-2">
                  {section.items.map((item, j) => (
                    <div key={j} className="rounded-lg border border-navy-100 p-3">
                      <dt className="text-xs text-navy-400">{item.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-navy-900">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          {/* Right-to-be-forgotten: permanently erase this lead */}
          <div className="mt-6 border-t border-navy-100 pt-4">
            {error && (
              <div className="mb-2 text-xs text-red-700">{error}</div>
            )}
            {!confirmErase ? (
              <button
                type="button"
                onClick={() => setConfirmErase(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-800"
              >
                <Icon name="trash" size={16} />
                מחיקת הפנייה לצמיתות
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-navy-700">
                  למחוק את הפנייה וכל פרטיה?
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => erase.mutate()}
                  disabled={erase.isPending}
                >
                  {erase.isPending ? (
                    <>
                      <Spinner /> מוחק…
                    </>
                  ) : (
                    "כן, מחק"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirmErase(false)}
                  disabled={erase.isPending}
                  className="rounded-lg px-3 py-1.5 text-sm text-navy-500 hover:bg-navy-50"
                >
                  ביטול
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string | null | undefined;
  ltr?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-navy-400">{label}</dt>
      <dd
        className="font-medium text-navy-900"
        dir={ltr ? "ltr" : undefined}
        style={ltr ? { textAlign: "start" } : undefined}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function channelLabel(v: string | null | undefined): string {
  if (v === "phone") return "טלפון";
  if (v === "whatsapp") return "וואטסאפ";
  if (v === "email") return "אימייל";
  return "—";
}

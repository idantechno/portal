import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { leadsApi } from "../../api/leads";
import { Card } from "../../components/ui";

export default function Leads() {
  const { t, i18n } = useTranslation();
  const { businessId = "" } = useParams<{ businessId: string }>();
  const leads = useQuery({
    queryKey: ["leads", businessId],
    queryFn: () => leadsApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const items = leads.data ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
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
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-start px-4 py-3">{t("leads.name")}</th>
                <th className="text-start px-4 py-3">{t("leads.phone")}</th>
                <th className="text-start px-4 py-3">{t("leads.email")}</th>
                <th className="text-start px-4 py-3">{t("leads.interest")}</th>
                <th className="text-start px-4 py-3">{t("leads.notes")}</th>
                <th className="text-start px-4 py-3">{t("leads.createdAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((l) => (
                <tr key={l.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium">{l.name}</td>
                  <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                    {l.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                    {l.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">{l.interest}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {l.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs" dir="ltr">
                    {new Date(l.createdAt).toLocaleString(
                      i18n.language === "he" ? "he-IL" : "en-US",
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

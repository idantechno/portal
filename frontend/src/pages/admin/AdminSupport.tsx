import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";
import { Button, Card, Spinner } from "../../components/ui";

type Tab = "open" | "resolved";

export default function AdminSupport() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("open");

  const requests = useQuery({
    queryKey: ["admin", "support", tab],
    queryFn: () => adminApi.listSupportRequests(tab),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => adminApi.resolveSupportRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "support"] }),
  });

  const items = requests.data ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("admin.supportInbox")}</h1>
        <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
          {(["open", "resolved"] as Tab[]).map((v) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === v
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {v === "open" ? t("admin.supportOpen") : t("admin.supportResolved")}
            </button>
          ))}
        </div>
      </div>

      {requests.isLoading && (
        <div className="text-sm text-neutral-500">{t("common.loading")}</div>
      )}
      {!requests.isLoading && items.length === 0 && (
        <Card className="p-10 text-center text-sm text-neutral-500">
          {t("admin.supportEmpty")}
        </Card>
      )}

      <div className="space-y-3">
        {items.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold text-neutral-900">
                  {r.subject}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {r.businessName ?? r.businessId} ·{" "}
                  <span dir="ltr">
                    {new Date(r.createdAt).toLocaleString("he-IL")}
                  </span>
                </div>
              </div>
              {r.status === "open" && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={resolve.isPending && resolve.variables === r.id}
                  onClick={() => resolve.mutate(r.id)}
                >
                  {resolve.isPending && resolve.variables === r.id ? (
                    <Spinner />
                  ) : (
                    t("admin.supportResolve")
                  )}
                </Button>
              )}
            </div>
            <p className="mt-3 text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
              {r.details}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

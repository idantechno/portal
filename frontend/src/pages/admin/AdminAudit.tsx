import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";
import { Button, Card } from "../../components/ui";

const PAGE = 50;

export default function AdminAudit() {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);

  const audit = useQuery({
    queryKey: ["admin", "audit", offset],
    queryFn: () => adminApi.audit({ limit: PAGE, offset }),
  });

  const total = audit.data?.total ?? 0;
  const items = audit.data?.items ?? [];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("admin.audit")}</h1>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Button
            size="sm"
            variant="ghost"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
          >
            ←
          </Button>
          <span>
            {offset + 1}–{Math.min(offset + PAGE, total)} / {total}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={offset + PAGE >= total}
            onClick={() => setOffset(offset + PAGE)}
          >
            →
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <th className="text-start font-medium px-4 py-3">{t("admin.when")}</th>
              <th className="text-start font-medium px-4 py-3">{t("admin.actor")}</th>
              <th className="text-start font-medium px-4 py-3">{t("admin.action")}</th>
              <th className="text-start font-medium px-4 py-3">{t("admin.target")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {items.map((e) => (
              <tr key={e.id} className="hover:bg-neutral-50 align-top">
                <td className="px-4 py-3 text-neutral-500 whitespace-nowrap" dir="ltr">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3" dir="ltr">
                  <div>{e.actorEmail ?? e.actorUserId ?? "—"}</div>
                  <div className="text-xs text-neutral-400">{e.actorRole}</div>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-neutral-100 rounded px-1.5 py-0.5">
                    {e.action}
                  </code>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500" dir="ltr">
                  {e.targetType ? `${e.targetType}:${e.targetId ?? ""}` : "—"}
                  {e.businessId && (
                    <div className="text-neutral-400">biz:{e.businessId}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {audit.isLoading && (
          <div className="p-6 text-sm text-neutral-500">{t("common.loading")}</div>
        )}
        {audit.data && items.length === 0 && (
          <div className="p-6 text-sm text-neutral-500">{t("admin.noResults")}</div>
        )}
      </Card>
    </div>
  );
}

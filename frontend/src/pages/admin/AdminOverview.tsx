import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";
import { Card } from "../../components/ui";

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <Card className="p-6">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
        {label}
      </div>
      <div
        className={`text-3xl font-bold ${
          tone === "danger" && value > 0 ? "text-red-600" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}

export default function AdminOverview() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: adminApi.overview,
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("admin.overview")}</h1>
      {q.isLoading && (
        <div className="text-neutral-500 text-sm">{t("common.loading")}</div>
      )}
      {q.data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label={t("admin.totalBusinesses")} value={q.data.totalBusinesses} />
          <Stat
            label={t("admin.suspendedBusinesses")}
            value={q.data.suspendedBusinesses}
            tone="danger"
          />
          <Stat label={t("admin.totalUsers")} value={q.data.totalUsers} />
          <Stat
            label={t("admin.suspendedUsers")}
            value={q.data.suspendedUsers}
            tone="danger"
          />
        </div>
      )}
    </div>
  );
}

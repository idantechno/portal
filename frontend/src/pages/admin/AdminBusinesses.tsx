import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";
import type { AccountStatus } from "../../api/types";
import { useAuthStore } from "../../store/auth";
import { isSuperAdmin } from "../../lib/roles";
import { Button, Card, Input, Spinner } from "../../components/ui";

function StatusPill({ status }: { status: AccountStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === "active"
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }`}
    >
      {status === "active" ? t("admin.active") : t("admin.suspended")}
    </span>
  );
}

export default function AdminBusinesses() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canModerate = isSuperAdmin(user?.role);
  const [q, setQ] = useState("");

  const businesses = useQuery({
    queryKey: ["admin", "businesses", q],
    queryFn: () => adminApi.listBusinesses(q || undefined),
  });

  const enter = useMutation({
    mutationFn: (id: string) => adminApi.accessBusiness(id),
    onSuccess: (_d, id) => navigate(`/app/businesses/${id}`),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
      adminApi.setBusinessStatus(id, status),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "businesses"] }),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold">{t("admin.businesses")}</h1>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("admin.search")}
          className="max-w-xs"
        />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <th className="text-start font-medium px-4 py-3">{t("admin.name")}</th>
              <th className="text-start font-medium px-4 py-3">{t("admin.owner")}</th>
              <th className="text-start font-medium px-4 py-3">{t("admin.members")}</th>
              <th className="text-start font-medium px-4 py-3">{t("admin.status")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {businesses.data?.map((b) => (
              <tr key={b.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link
                    to={`/app/admin/businesses/${b.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {b.name}
                  </Link>
                  <div className="text-xs text-neutral-500" dir="ltr">
                    /{b.slug}
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-600" dir="ltr">
                  {b.owner?.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-neutral-600">{b.memberCount}</td>
                <td className="px-4 py-3">
                  <StatusPill status={b.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    {canModerate && (
                      <Button
                        size="sm"
                        variant={b.status === "active" ? "ghost" : "secondary"}
                        onClick={() =>
                          setStatus.mutate({
                            id: b.id,
                            status:
                              b.status === "active" ? "suspended" : "active",
                          })
                        }
                      >
                        {b.status === "active"
                          ? t("admin.suspend")
                          : t("admin.activate")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={enter.isPending}
                      onClick={() => enter.mutate(b.id)}
                    >
                      {enter.isPending && enter.variables === b.id ? (
                        <Spinner />
                      ) : (
                        t("admin.enter")
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {businesses.isLoading && (
          <div className="p-6 text-sm text-neutral-500">{t("common.loading")}</div>
        )}
        {businesses.data && businesses.data.length === 0 && (
          <div className="p-6 text-sm text-neutral-500">
            {t("admin.noResults")}
          </div>
        )}
      </Card>
    </div>
  );
}

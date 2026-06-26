import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";
import type { AccountStatus, UserRole } from "../../api/types";
import { useAuthStore } from "../../store/auth";
import { isSuperAdmin } from "../../lib/roles";
import { Button, Card, Input } from "../../components/ui";

const ROLE_OPTIONS: UserRole[] = ["member", "support", "super_admin"];

export default function AdminUsers() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const canModerate = isSuperAdmin(me?.role);
  const [q, setQ] = useState("");

  const roleLabel: Record<UserRole, string> = {
    super_admin: t("admin.superAdmin"),
    support: t("admin.support"),
    member: t("admin.member"),
  };

  const users = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => adminApi.listUsers(q || undefined),
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      adminApi.setUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
      adminApi.setUserStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold">{t("admin.users")}</h1>
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
              <th className="text-start font-medium px-4 py-3">{t("admin.role")}</th>
              <th className="text-start font-medium px-4 py-3">{t("admin.businessCount")}</th>
              <th className="text-start font-medium px-4 py-3">{t("admin.status")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.data?.map((u) => {
              const isSelf = u.id === me?.id;
              return (
                <tr key={u.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-neutral-500" dir="ltr">
                      {u.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canModerate && !isSelf ? (
                      <select
                        value={u.role}
                        onChange={(e) =>
                          setRole.mutate({
                            id: u.id,
                            role: e.target.value as UserRole,
                          })
                        }
                        className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{roleLabel[u.role]}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{u.businessCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {u.status === "active"
                        ? t("admin.active")
                        : t("admin.suspended")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    {canModerate && !isSelf && (
                      <Button
                        size="sm"
                        variant={u.status === "active" ? "ghost" : "secondary"}
                        onClick={() =>
                          setStatus.mutate({
                            id: u.id,
                            status:
                              u.status === "active" ? "suspended" : "active",
                          })
                        }
                      >
                        {u.status === "active"
                          ? t("admin.suspend")
                          : t("admin.activate")}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.isLoading && (
          <div className="p-6 text-sm text-neutral-500">{t("common.loading")}</div>
        )}
        {users.data && users.data.length === 0 && (
          <div className="p-6 text-sm text-neutral-500">{t("admin.noResults")}</div>
        )}
      </Card>
    </div>
  );
}

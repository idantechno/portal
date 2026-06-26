import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../../api/businesses";
import { apiErrorMessage } from "../../api/client";
import type { BusinessRole } from "../../api/types";
import { useAuthStore } from "../../store/auth";
import {
  Button,
  Card,
  FormError,
  Input,
  Label,
  Spinner,
} from "../../components/ui";

const ROLE_OPTIONS: BusinessRole[] = ["owner", "admin", "agent", "viewer"];

export default function Members() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const { businessId = "" } = useParams<{ businessId: string }>();

  const roleLabel: Record<BusinessRole, string> = {
    owner: t("members.roleOwner"),
    admin: t("members.roleAdmin"),
    agent: t("members.roleAgent"),
    viewer: t("members.roleViewer"),
  };

  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });
  const members = useQuery({
    queryKey: ["business", businessId, "members"],
    queryFn: () => businessesApi.listMembers(businessId),
    enabled: Boolean(businessId),
  });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<BusinessRole>("agent");
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () =>
      businessesApi.addMember(businessId, {
        email,
        name,
        role,
        temporaryPassword: tempPassword,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business", businessId, "members"] });
      setEmail("");
      setName("");
      setRole("agent");
      setTempPassword("");
    },
    onError: (err) => setError(apiErrorMessage(err, t("members.addFailed"))),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: BusinessRole }) =>
      businessesApi.updateMemberRole(businessId, userId, role),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["business", businessId, "members"] }),
  });

  const remove = useMutation({
    mutationFn: (userId: string) =>
      businessesApi.removeMember(businessId, userId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["business", businessId, "members"] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    add.mutate();
  }

  const ownerUserId = biz.data?.ownerUserId;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{t("members.title")}</h1>
        <p className="text-sm text-neutral-500 mt-1">{t("members.subtitle")}</p>
      </header>

      <Card className="overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <th className="text-start font-medium px-4 py-3">{t("members.name")}</th>
              <th className="text-start font-medium px-4 py-3">{t("members.role")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {members.data?.map((m) => {
              const isFounder = m.userId === ownerUserId;
              const isSelf = m.userId === me?.id;
              return (
                <tr key={m.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {m.user?.name ?? "—"}
                      {isSelf && (
                        <span className="text-xs text-neutral-400 ms-2">
                          ({t("members.you")})
                        </span>
                      )}
                      {isFounder && (
                        <span className="text-xs text-amber-600 ms-2">
                          ({t("members.founder")})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500" dir="ltr">
                      {m.user?.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isFounder ? (
                      <span>{roleLabel[m.role]}</span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          changeRole.mutate({
                            userId: m.userId,
                            role: e.target.value as BusinessRole,
                          })
                        }
                        className="rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-sm focus:bg-white focus:border-brand-500 focus:outline-none"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel[r]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {!isFounder && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (
                            window.confirm(
                              t("members.removeConfirm", {
                                name: m.user?.name ?? m.user?.email ?? "",
                              }),
                            )
                          ) {
                            remove.mutate(m.userId);
                          }
                        }}
                      >
                        {t("members.remove")}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {members.isLoading && (
          <div className="p-6 text-sm text-neutral-500">{t("common.loading")}</div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">{t("members.addMember")}</h2>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="m-name">{t("members.name")}</Label>
              <Input
                id="m-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="m-email">{t("members.email")}</Label>
              <Input
                id="m-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="m-role">{t("members.role")}</Label>
              <select
                id="m-role"
                value={role}
                onChange={(e) => setRole(e.target.value as BusinessRole)}
                className="block w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm focus:bg-white focus:border-brand-500 focus:outline-none"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="m-pw">{t("members.tempPassword")}</Label>
              <Input
                id="m-pw"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                minLength={8}
                required
                dir="ltr"
              />
            </div>
          </div>
          <FormError message={error} />
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? <Spinner /> : t("members.add")}
          </Button>
        </form>
      </Card>
    </div>
  );
}

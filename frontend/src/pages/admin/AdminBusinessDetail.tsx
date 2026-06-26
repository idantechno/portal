import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";
import type { AgentAccessView } from "../../api/types";
import { useAuthStore } from "../../store/auth";
import { isSuperAdmin } from "../../lib/roles";
import { Button, Card, Spinner } from "../../components/ui";

function Toggle({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      aria-pressed={enabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? "bg-brand-600" : "bg-neutral-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function AdminBusinessDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { businessId = "" } = useParams<{ businessId: string }>();
  const me = useAuthStore((s) => s.user);
  const canModerate = isSuperAdmin(me?.role);

  const detail = useQuery({
    queryKey: ["admin", "business", businessId],
    queryFn: () => adminApi.businessDetail(businessId),
    enabled: Boolean(businessId),
  });
  const agents = useQuery({
    queryKey: ["admin", "business", businessId, "agents"],
    queryFn: () => adminApi.businessAgents(businessId),
    enabled: Boolean(businessId),
  });

  const setAgent = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      adminApi.setBusinessAgent(businessId, key, enabled),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin", "business", businessId, "agents"],
      }),
  });

  const enter = useMutation({
    mutationFn: () => adminApi.accessBusiness(businessId),
    onSuccess: () => navigate(`/app/businesses/${businessId}`),
  });

  const business = detail.data?.business;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        to="/app/admin/businesses"
        className="text-sm text-neutral-500 hover:text-neutral-800"
      >
        ← {t("admin.backToBusinesses")}
      </Link>

      <div className="flex items-center justify-between mt-3 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">{business?.name ?? "—"}</h1>
          <div className="text-sm text-neutral-500" dir="ltr">
            /{business?.slug ?? ""}
          </div>
        </div>
        <Button
          variant="secondary"
          disabled={enter.isPending}
          onClick={() => enter.mutate()}
        >
          {enter.isPending ? <Spinner /> : t("admin.enter")}
        </Button>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold mb-1">{t("admin.agents")}</h2>
        <p className="text-sm text-neutral-500 mb-4">{t("admin.agentsHint")}</p>
        {agents.isLoading && <Spinner />}
        <div className="space-y-2">
          {agents.data?.map((a: AgentAccessView) => (
            <div
              key={a.key}
              className="flex items-center gap-4 rounded-lg border border-neutral-200 p-4"
            >
              <div className="text-2xl shrink-0">{a.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{a.name}</div>
                <div className="text-sm text-neutral-500">{a.description}</div>
              </div>
              <span
                className={`text-xs font-medium ${
                  a.enabled ? "text-brand-700" : "text-neutral-400"
                }`}
              >
                {a.enabled ? t("admin.on") : t("admin.off")}
              </span>
              <Toggle
                enabled={a.enabled}
                disabled={!canModerate || setAgent.isPending}
                onChange={() =>
                  setAgent.mutate({ key: a.key, enabled: !a.enabled })
                }
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold">{t("admin.members")}</h2>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-neutral-100">
            {detail.data?.members.map((m) => (
              <tr key={m.id}>
                <td className="px-6 py-3">
                  <div className="font-medium">{m.user?.name ?? "—"}</div>
                  <div className="text-xs text-neutral-500" dir="ltr">
                    {m.user?.email}
                  </div>
                </td>
                <td className="px-6 py-3 text-neutral-600">{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

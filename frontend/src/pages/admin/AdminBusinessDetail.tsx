import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";
import type { AgentAccessView, AdminPlanView } from "../../api/types";
import type { TemplateAccessView } from "../../api/templates";
import { useAuthStore } from "../../store/auth";
import { isSuperAdmin } from "../../lib/roles";
import { Badge, Button, Card, Spinner } from "../../components/ui";
import { Icon, ServerIcon } from "../../components/icons";

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

/**
 * One block inside the permissions area. Every permission type (agents now;
 * capabilities, feature flags, etc. later) renders as a PermissionSection, so
 * adding a new kind of permission is just another <PermissionSection> below.
 */
function PermissionSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-neutral-100 pt-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2">
        <ServerIcon name={icon} size={18} className="text-brand-500" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      {hint && <p className="-mt-2 mb-3 text-sm text-neutral-500">{hint}</p>}
      {children}
    </section>
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

  const invalidateAgents = () =>
    qc.invalidateQueries({
      queryKey: ["admin", "business", businessId, "agents"],
    });

  const setAgent = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      adminApi.setBusinessAgent(businessId, key, enabled),
    onSuccess: invalidateAgents,
  });

  const resetAgent = useMutation({
    mutationFn: (key: string) => adminApi.resetBusinessAgent(businessId, key),
    onSuccess: invalidateAgents,
  });

  const templates = useQuery({
    queryKey: ["admin", "business", businessId, "templates"],
    queryFn: () => adminApi.businessTemplates(businessId),
    enabled: Boolean(businessId),
  });
  const invalidateTemplates = () =>
    qc.invalidateQueries({
      queryKey: ["admin", "business", businessId, "templates"],
    });
  const setTemplate = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      adminApi.setBusinessTemplate(businessId, name, enabled),
    onSuccess: invalidateTemplates,
  });
  const resetTemplate = useMutation({
    mutationFn: (name: string) =>
      adminApi.resetBusinessTemplate(businessId, name),
    onSuccess: invalidateTemplates,
  });

  const enter = useMutation({
    mutationFn: () => adminApi.accessBusiness(businessId),
    onSuccess: () => navigate(`/app/businesses/${businessId}`),
  });

  const invalidateBusiness = () => {
    qc.invalidateQueries({ queryKey: ["admin", "business", businessId] });
    qc.invalidateQueries({ queryKey: ["admin", "businesses"] });
  };
  const scheduleDelete = useMutation({
    mutationFn: () => adminApi.deleteBusiness(businessId),
    onSuccess: invalidateBusiness,
  });
  const restore = useMutation({
    mutationFn: () => adminApi.restoreBusiness(businessId),
    onSuccess: invalidateBusiness,
  });

  const [confirmName, setConfirmName] = useState("");
  const business = detail.data?.business;
  const plan: AdminPlanView | undefined = detail.data?.plan;
  // Entitled agents first, then by name — the operator sees active grants on top.
  const sortedAgents = [...(agents.data ?? [])].sort(
    (a, b) =>
      Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name, "he"),
  );
  const deletedAt = business?.deletedAt ?? null;
  const purgeAt = deletedAt
    ? new Date(new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;
  const fmt = (d: Date) => d.toLocaleDateString("he-IL", { dateStyle: "long" });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        to="/app/admin/businesses"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-800"
      >
        <Icon name="arrow-start" size={16} />
        {t("admin.backToBusinesses")}
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
        <div className="mb-1 flex items-center gap-2">
          <Icon name="lock" size={18} className="text-brand-500" />
          <h2 className="font-semibold">{t("admin.permissions")}</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">
          {t("admin.permissionsHint")}
        </p>

        {/* Current plan header — read-only; the plan is changed elsewhere. */}
        {plan && (
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-brand-50/60 px-4 py-3">
            <span className="text-sm text-neutral-500">
              {t("admin.currentPlan")}:
            </span>
            <span className="font-semibold text-navy-900">{plan.name}</span>
            <span className="text-sm text-neutral-400" dir="ltr">
              {plan.nameEn}
            </span>
            {plan.tagline && (
              <span className="w-full text-xs text-neutral-500">
                {plan.tagline} · {t("admin.planNote")}
              </span>
            )}
          </div>
        )}

        <div className="space-y-6">
          {/* Block 1 — agents */}
          <PermissionSection icon="agents" title={t("admin.agents")}>
            {agents.isLoading && <Spinner />}
            <div className="space-y-2">
              {sortedAgents.map((a: AgentAccessView) => (
                <div
                  key={a.key}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-neutral-200 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                    <ServerIcon name={a.icon} size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      <Badge tone={a.overridden ? "brand" : "neutral"}>
                        {a.overridden
                          ? t("admin.sourceManual")
                          : t("admin.sourcePlan")}
                      </Badge>
                    </div>
                    <div className="text-sm text-neutral-500">
                      {a.description}
                    </div>
                  </div>
                  {a.overridden && canModerate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="refresh"
                      disabled={resetAgent.isPending}
                      onClick={() => resetAgent.mutate(a.key)}
                    >
                      {t("admin.resetToPlan")}
                    </Button>
                  )}
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
          </PermissionSection>

          {/* Block 1b — WhatsApp templates (base for all + special per client) */}
          <PermissionSection
            icon="doc"
            title="טמפלייטים"
            hint="תבניות וואטסאפ שהעסק רשאי לשלוח. הבסיסיות דלוקות לכולם; מיוחדות מעניקים פר-עסק."
          >
            {templates.isLoading && <Spinner />}
            <div className="space-y-2">
              {(templates.data ?? []).map((tpl: TemplateAccessView) => (
                <div
                  key={tpl.name}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-neutral-200 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <ServerIcon name="whatsapp" size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tpl.title}</span>
                      <Badge tone={tpl.overridden ? "brand" : "neutral"}>
                        {tpl.overridden ? "ידני" : "ברירת מחדל"}
                      </Badge>
                    </div>
                    <div className="text-sm text-neutral-500">
                      {tpl.description}
                    </div>
                  </div>
                  {tpl.overridden && canModerate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="refresh"
                      disabled={resetTemplate.isPending}
                      onClick={() => resetTemplate.mutate(tpl.name)}
                    >
                      {t("admin.resetToPlan")}
                    </Button>
                  )}
                  <span
                    className={`text-xs font-medium ${
                      tpl.enabled ? "text-brand-700" : "text-neutral-400"
                    }`}
                  >
                    {tpl.enabled ? t("admin.on") : t("admin.off")}
                  </span>
                  <Toggle
                    enabled={tpl.enabled}
                    disabled={!canModerate || setTemplate.isPending}
                    onChange={() =>
                      setTemplate.mutate({
                        name: tpl.name,
                        enabled: !tpl.enabled,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </PermissionSection>

          {/* Block 2 — plan capabilities (read-only) proves the extensibility
              pattern: a new permission type slots in as another section here. */}
          <PermissionSection
            icon="check"
            title={t("admin.planCapabilities")}
            hint={t("admin.planCapabilitiesHint")}
          >
            {plan && plan.capabilities.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {plan.capabilities.map((c) => (
                  <li key={c.key}>
                    <Badge tone="success" icon="check">
                      {c.label}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-400">
                {t("admin.noCapabilities")}
              </p>
            )}
          </PermissionSection>
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

      {canModerate && business && (
        <Card className="mt-6 border-red-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="warning" size={18} className="text-red-600" />
            <h2 className="font-semibold text-red-900">אזור מסוכן</h2>
          </div>

          {deletedAt ? (
            <>
              <p className="text-sm text-red-800">
                העסק מתוזמן למחיקה ונעלם מהמערכת. המחיקה הסופית והבלתי הפיכה תתבצע
                אוטומטית בתאריך{" "}
                <span className="font-semibold">{purgeAt ? fmt(purgeAt) : "—"}</span>
                . עד אז ניתן לשחזר.
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                disabled={restore.isPending}
                onClick={() => restore.mutate()}
              >
                {restore.isPending ? <Spinner /> : "שחזור העסק"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-600">
                מחיקת העסק תסתיר אותו מיד ותתזמן מחיקה סופית של כל הנתונים
                (לקוחות, שיחות, קבצים, חיבורים) בעוד 30 יום. ניתן לשחזר בתוך
                החלון. להמשך, הקלד את שם העסק:{" "}
                <span className="font-semibold">{business.name}</span>
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="שם העסק לאישור"
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
                <Button
                  variant="danger"
                  disabled={
                    confirmName.trim() !== business.name ||
                    scheduleDelete.isPending
                  }
                  onClick={() => scheduleDelete.mutate()}
                >
                  {scheduleDelete.isPending ? <Spinner /> : "מחיקת העסק"}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

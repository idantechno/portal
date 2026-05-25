import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { whatsappApi, type WhatsappStatus } from "../../api/whatsapp";
import { apiErrorMessage } from "../../api/client";
import { Button, Card, FormError, Spinner } from "../../components/ui";
import { runEmbeddedSignup } from "../../lib/meta-embedded-signup";

const META_APP_ID = import.meta.env.VITE_META_APP_ID as string | undefined;
const META_CONFIG_ID = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID as
  | string
  | undefined;
const META_GRAPH_VERSION =
  (import.meta.env.VITE_META_GRAPH_API_VERSION as string | undefined) ?? "v21.0";

function statusBadge(
  status: WhatsappStatus | undefined,
  labels: Record<WhatsappStatus, string>,
) {
  if (!status) return null;
  const tone =
    status === "active"
      ? "bg-green-100 text-green-800"
      : status === "failed"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";
  return (
    <span
      className={`inline-block rounded-full text-xs px-2.5 py-0.5 font-medium ${tone}`}
    >
      {labels[status]}
    </span>
  );
}

export default function WhatsappSettings() {
  const { t } = useTranslation();
  const { businessId = "" } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const conn = useQuery({
    queryKey: ["whatsapp", businessId],
    queryFn: () => whatsappApi.get(businessId),
    enabled: Boolean(businessId),
  });

  const exchange = useMutation({
    mutationFn: async () => {
      if (!META_APP_ID || !META_CONFIG_ID) {
        throw new Error(t("whatsapp.notConfigured"));
      }
      const result = await runEmbeddedSignup({
        appId: META_APP_ID,
        configId: META_CONFIG_ID,
        graphVersion: META_GRAPH_VERSION,
      });
      return whatsappApi.exchange(businessId, result);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp", businessId] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err, t("whatsapp.connectFailed"))),
  });

  const remove = useMutation({
    mutationFn: () => whatsappApi.delete(businessId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp", businessId] }),
  });

  const statusLabels: Record<WhatsappStatus, string> = {
    pending: t("whatsapp.statusPending"),
    active: t("whatsapp.statusActive"),
    failed: t("whatsapp.statusFailed"),
  };

  const metaConfigured = Boolean(META_APP_ID && META_CONFIG_ID);
  const isConnected = conn.data?.status === "active";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("whatsapp.title")}</h1>
          <p className="text-neutral-600 text-sm mt-1">
            {t("whatsapp.subtitle")}
          </p>
        </div>
        {conn.data && statusBadge(conn.data.status, statusLabels)}
      </header>

      {conn.data?.lastError && (
        <Card className="p-4 mb-4 border-red-200 bg-red-50">
          <div className="text-xs uppercase text-red-700 font-semibold mb-1">
            {t("whatsapp.lastError")}
          </div>
          <div className="text-sm text-red-800 font-mono" dir="ltr">
            {conn.data.lastError}
          </div>
        </Card>
      )}

      {!metaConfigured && (
        <Card className="p-4 mb-4 border-amber-200 bg-amber-50">
          <div className="text-sm text-amber-900">
            {t("whatsapp.notConfigured")}
          </div>
        </Card>
      )}

      <Card className="p-6 mb-6">
        {isConnected && conn.data ? (
          <div className="space-y-3">
            <div className="text-sm text-neutral-700">
              {t("whatsapp.connectedTo")}
            </div>
            <div className="text-lg font-semibold" dir="ltr">
              {conn.data.displayPhoneNumber ?? conn.data.phoneNumberId}
            </div>
            <div className="text-xs text-neutral-500 font-mono" dir="ltr">
              waba_id: {conn.data.wabaId ?? "—"}
              {" · "}phone_number_id: {conn.data.phoneNumberId ?? "—"}
            </div>
            {conn.data.connectedAt && (
              <div className="text-xs text-neutral-500">
                {t("whatsapp.connectedAt", {
                  date: new Date(conn.data.connectedAt).toLocaleString(),
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-700">
              {t("whatsapp.connectIntro")}
            </p>
            <Button
              disabled={!metaConfigured || exchange.isPending}
              onClick={() => {
                setError(null);
                exchange.mutate();
              }}
            >
              {exchange.isPending ? (
                <>
                  <Spinner /> {t("whatsapp.connecting")}
                </>
              ) : (
                t("whatsapp.connect")
              )}
            </Button>
            <FormError message={error} />
          </div>
        )}
      </Card>

      {isConnected && (
        <Card className="p-6 border-red-200">
          <div className="text-sm text-neutral-600 mb-3">
            {t("whatsapp.disconnectIntro")}
          </div>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(t("whatsapp.disconnectConfirm"))) remove.mutate();
            }}
          >
            {t("whatsapp.disconnect")}
          </Button>
        </Card>
      )}
    </div>
  );
}

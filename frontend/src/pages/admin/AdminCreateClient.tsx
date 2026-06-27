import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";
import { apiErrorMessage } from "../../api/client";
import type { CreateClientResult } from "../../api/types";
import {
  Button,
  Card,
  FormError,
  Input,
  Label,
  Spinner,
} from "../../components/ui";

export default function AdminCreateClient() {
  const { t } = useTranslation();

  const catalog = useQuery({
    queryKey: ["admin", "agents", "catalog"],
    queryFn: adminApi.agentCatalog,
  });

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [agentKeys, setAgentKeys] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateClientResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Default selection = catalog defaults, until the admin changes it.
  const selected =
    agentKeys ??
    (catalog.data ?? []).filter((a) => a.defaultEnabled).map((a) => a.key);

  function toggle(key: string) {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    setAgentKeys(next);
  }

  const create = useMutation({
    mutationFn: () =>
      adminApi.createClient({
        businessName,
        ownerName,
        ownerEmail,
        slug: slug.trim() || undefined,
        agentKeys: selected,
      }),
    onSuccess: (r) => setResult(r),
    onError: (err) =>
      setError(apiErrorMessage(err, t("admin.createClientFailed"))),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate();
  }

  function reset() {
    setBusinessName("");
    setOwnerName("");
    setOwnerEmail("");
    setSlug("");
    setAgentKeys(null);
    setError(null);
    setResult(null);
  }

  if (result) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <Card className="p-6">
          <div className="text-2xl mb-2">✅</div>
          <h1 className="text-xl font-bold mb-1">{t("admin.clientCreated")}</h1>
          <p className="text-sm text-neutral-500 mb-5">
            {t("admin.shareCredsHint")}
          </p>
          <div className="space-y-3">
            <Field label={t("admin.clientBusinessName")} value={result.business.name} />
            <Field label={t("admin.clientOwnerEmail")} value={result.owner.email} ltr />
            {result.temporaryPassword ? (
              <div>
                <Label>{t("admin.tempPassword")}</Label>
                <div className="flex items-center gap-2">
                  <Input value={result.temporaryPassword} readOnly dir="ltr" />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(result.temporaryPassword!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? t("settings.copied") : t("settings.copy")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                {t("admin.ownerExistedNote")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-6">
            <Button onClick={reset}>{t("admin.createAnother")}</Button>
            <Link
              to="/app/admin/businesses"
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >
              {t("admin.backToBusinesses")}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <Link
        to="/app/admin/businesses"
        className="text-sm text-neutral-500 hover:text-neutral-800"
      >
        ← {t("admin.backToBusinesses")}
      </Link>
      <h1 className="text-2xl font-bold mt-3 mb-6">{t("admin.createClient")}</h1>

      <Card className="p-6">
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="c-biz">{t("admin.clientBusinessName")}</Label>
            <Input
              id="c-biz"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="c-owner">{t("admin.clientOwnerName")}</Label>
              <Input
                id="c-owner"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="c-email">{t("admin.clientOwnerEmail")}</Label>
              <Input
                id="c-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
                dir="ltr"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="c-slug">{t("admin.clientSlug")}</Label>
            <Input
              id="c-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="auto"
              dir="ltr"
            />
          </div>

          <div>
            <Label>{t("admin.clientAgents")}</Label>
            <div className="space-y-2 mt-1">
              {catalog.data?.map((a) => (
                <label
                  key={a.key}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 cursor-pointer hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(a.key)}
                    onChange={() => toggle(a.key)}
                  />
                  <span className="text-xl">{a.icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{a.name}</span>
                    <span className="block text-xs text-neutral-500">
                      {a.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <FormError message={error} />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <Spinner /> : t("admin.createClient")}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} readOnly dir={ltr ? "ltr" : undefined} />
    </div>
  );
}

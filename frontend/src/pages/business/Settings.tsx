import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../../api/businesses";
import { apiErrorMessage } from "../../api/client";
import {
  Button,
  Card,
  FormError,
  Input,
  Label,
  Spinner,
  Textarea,
} from "../../components/ui";

function buildSnippet(publicKey: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-app";
  return `<script src="${origin}/widget.js" data-public-key="${publicKey}" async></script>`;
}

export default function Settings() {
  const { t } = useTranslation();
  const { businessId = "" } = useParams<{ businessId: string }>();
  const qc = useQueryClient();

  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [allowedOriginsText, setAllowedOriginsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (biz.data) {
      setName(biz.data.name);
      setSlug(biz.data.slug);
      setSystemPrompt(biz.data.systemPromptOverride ?? "");
      setAllowedOriginsText(
        (biz.data.widgetAllowedOrigins ?? []).join("\n"),
      );
    }
  }, [biz.data]);

  const save = useMutation({
    mutationFn: () =>
      businessesApi.update(businessId, {
        name,
        slug,
        systemPromptOverride: systemPrompt,
        widgetAllowedOrigins: allowedOriginsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business", businessId] });
      qc.invalidateQueries({ queryKey: ["businesses"] });
      setSavedAt(Date.now());
    },
    onError: (err) => setError(apiErrorMessage(err, "Save failed")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  function copySnippet() {
    if (!biz.data) return;
    navigator.clipboard.writeText(buildSnippet(biz.data.publicKey));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (biz.isLoading || !biz.data) {
    return <div className="p-8 text-neutral-500 text-sm">{t("common.loading")}</div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      </header>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold mb-4">{t("settings.general")}</h2>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="biz-name">{t("settings.name")}</Label>
            <Input
              id="biz-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="biz-slug">{t("settings.slug")}</Label>
            <Input
              id="biz-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              required
              dir="ltr"
            />
          </div>
          <div>
            <Label htmlFor="sysprompt">{t("settings.systemPrompt")}</Label>
            <Textarea
              id="sysprompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={8}
              className="min-h-32 font-mono text-xs"
            />
            <p className="text-xs text-neutral-500 mt-1">
              {t("settings.systemPromptHint")}
            </p>
          </div>
          <FormError message={error} />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner /> : t("settings.save")}
            </Button>
            {savedAt && Date.now() - savedAt < 3000 && (
              <span className="text-sm text-green-700">{t("settings.saved")}</span>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">{t("settings.webWidget")}</h2>
        <div className="space-y-4">
          <div>
            <Label>{t("settings.publicKey")}</Label>
            <Input value={biz.data.publicKey} readOnly dir="ltr" />
          </div>
          <div>
            <Label>{t("settings.embedSnippet")}</Label>
            <div className="relative">
              <pre
                className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs font-mono overflow-x-auto"
                dir="ltr"
              >
                {buildSnippet(biz.data.publicKey)}
              </pre>
              <button
                type="button"
                onClick={copySnippet}
                className="absolute top-2 end-2 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs hover:bg-neutral-50"
              >
                {copied ? t("settings.copied") : t("settings.copy")}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="allowed-origins">
              {t("settings.allowedOrigins")}
            </Label>
            <Textarea
              id="allowed-origins"
              value={allowedOriginsText}
              onChange={(e) => setAllowedOriginsText(e.target.value)}
              rows={3}
              dir="ltr"
              className="font-mono text-xs"
              placeholder="https://example.com&#10;https://www.example.com"
            />
            <p className="text-xs text-neutral-500 mt-1">
              {t("settings.allowedOriginsHint")}
            </p>
          </div>
          <div>
            <a
              href="/widget-test.html"
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 hover:underline text-sm"
            >
              {t("settings.testWidget")} →
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}

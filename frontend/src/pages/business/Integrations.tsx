import { useState } from "react";
import type { FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { integrationsApi } from "../../api/integrations";
import type { IntegrationProvider, IntegrationView } from "../../api/integrations";
import { greenInvoiceApi } from "../../api/greenInvoice";
import { apiErrorMessage } from "../../api/client";
import { Button, Card, FormError, Input, Spinner, Textarea } from "../../components/ui";

export default function Integrations() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  const list = useQuery({
    queryKey: ["integrations", businessId],
    queryFn: () => integrationsApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const connectMut = useMutation({
    mutationFn: (provider: IntegrationProvider) =>
      integrationsApi.authUrl(businessId, provider),
    onSuccess: (url) => {
      // Same-tab round-trip; Google redirects back to this page when done.
      window.location.href = url;
    },
  });

  function clearBanner() {
    searchParams.delete("connected");
    searchParams.delete("error");
    setSearchParams(searchParams, { replace: true });
  }
  const disconnectMut = useMutation({
    mutationFn: (provider: IntegrationProvider) =>
      integrationsApi.disconnect(businessId, provider),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["integrations", businessId] }),
  });

  const items = list.data ?? [];
  const gmailConnected =
    items.find((i) => i.provider === "gmail")?.status === "connected";

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900 mb-1">אינטגרציות</h1>
        <p className="text-navy-500 text-sm">
          חבר את כלי Google של העסק כדי שהסוכנים יוכלו לפעול מולם.
        </p>
      </header>

      {connected && (
        <div className="mb-4 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800 flex items-center justify-between">
          <span>החיבור ל-{connected} בוצע בהצלחה ✓</span>
          <button onClick={clearBanner} className="text-teal-600 hover:text-teal-800">✕</button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl bg-coral-50 border border-coral-200 px-4 py-3 text-sm text-coral-700 flex items-center justify-between">
          <span>החיבור נכשל ({error}). נסה שוב.</span>
          <button onClick={clearBanner} className="text-coral-600 hover:text-coral-800">✕</button>
        </div>
      )}

      {list.isLoading && <div className="text-navy-400 text-sm">טוען...</div>}

      <div className="space-y-3">
        {items.map((it) => (
          <ProviderRow
            key={it.provider}
            it={it}
            connecting={connectMut.isPending}
            onConnect={() => connectMut.mutate(it.provider)}
            onDisconnect={() => disconnectMut.mutate(it.provider)}
          />
        ))}
      </div>

      {gmailConnected && <GmailCompose businessId={businessId} />}

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-brand-600 mb-3">
          חשבוניות — חשבונית ירוקה
        </h2>
        <GreenInvoiceCard businessId={businessId} />
      </div>

      {items.some((i) => !i.available) && (
        <p className="text-xs text-navy-400 mt-6 leading-relaxed">
          חיבור Google דורש הגדרת אפליקציית OAuth (משתני סביבה
          GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). עד שזה יוגדר, הכפתורים
          מושבתים.
        </p>
      )}
    </div>
  );
}

function ProviderRow({
  it,
  connecting,
  onConnect,
  onDisconnect,
}: {
  it: IntegrationView;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = it.status === "connected";
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="h-11 w-11 rounded-2xl bg-cream-50 border border-navy-100 flex items-center justify-center text-2xl shrink-0">
        {it.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-navy-900 text-sm">{it.name}</div>
        <div className="text-xs text-navy-400 truncate">
          {connected
            ? `מחובר${it.accountEmail ? ` · ${it.accountEmail}` : ""}`
            : it.description}
        </div>
      </div>
      {connected ? (
        <Button variant="ghost" size="sm" onClick={onDisconnect}>
          נתק
        </Button>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          disabled={!it.available || connecting}
          onClick={onConnect}
        >
          {it.available ? "חבר" : "בקרוב"}
        </Button>
      )}
    </Card>
  );
}

function GmailCompose({ businessId }: { businessId: string }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendMut = useMutation({
    mutationFn: () => integrationsApi.sendEmail(businessId, { to, subject, body }),
    onSuccess: () => {
      setSentTo(to);
      setTo("");
      setSubject("");
      setBody("");
    },
    onError: (err) => setError(apiErrorMessage(err, "שליחת המייל נכשלה")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSentTo(null);
    if (to && subject && body) sendMut.mutate();
  }

  return (
    <Card className="p-5 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">✉️</span>
        <span className="font-semibold text-navy-900">שלח מייל דרך Gmail</span>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="אל (כתובת מייל)"
          dir="ltr"
        />
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="נושא"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="תוכן ההודעה..."
          className="min-h-28"
        />
        <FormError message={error} />
        {sentTo && (
          <div className="rounded-xl bg-teal-50 border border-teal-200 px-3.5 py-2.5 text-sm text-teal-800">
            המייל נשלח אל {sentTo} ✓
          </div>
        )}
        <Button type="submit" disabled={sendMut.isPending}>
          {sendMut.isPending ? <Spinner /> : "שלח מייל"}
        </Button>
      </form>
    </Card>
  );
}

function GreenInvoiceCard({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["green-invoice", businessId],
    queryFn: () => greenInvoiceApi.status(businessId),
    enabled: Boolean(businessId),
  });
  const [apiKeyId, setApiKeyId] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">(
    "sandbox",
  );
  const [error, setError] = useState<string | null>(null);

  const connectMut = useMutation({
    mutationFn: () =>
      greenInvoiceApi.connect(businessId, { apiKeyId, apiSecret, environment }),
    onSuccess: () => {
      setApiKeyId("");
      setApiSecret("");
      qc.invalidateQueries({ queryKey: ["green-invoice", businessId] });
    },
    onError: (err) =>
      setError(apiErrorMessage(err, "החיבור נכשל — בדוק את המפתחות")),
  });
  const disconnectMut = useMutation({
    mutationFn: () => greenInvoiceApi.disconnect(businessId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["green-invoice", businessId] }),
  });

  const s = status.data;

  if (s?.connected) {
    return (
      <Card className="p-4 flex items-center gap-4">
        <div className="h-11 w-11 rounded-2xl bg-cream-50 border border-navy-100 flex items-center justify-center text-2xl shrink-0">
          🧾
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-navy-900 text-sm">
            חשבונית ירוקה מחוברת
          </div>
          <div className="text-xs text-navy-400">
            סביבה: {s.environment === "production" ? "פרודקשן" : "בדיקה (sandbox)"}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => disconnectMut.mutate()}>
          נתק
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-sm text-navy-500 mb-3">
        חבר את חשבון חשבונית ירוקה שלך (מפתח API) כדי להנפיק חשבוניות אמיתיות
        מהמערכת.
      </p>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          if (apiKeyId && apiSecret) connectMut.mutate();
        }}
        className="space-y-3"
      >
        <Input
          value={apiKeyId}
          onChange={(e) => setApiKeyId(e.target.value)}
          placeholder="API Key ID"
          dir="ltr"
        />
        <Input
          type="password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder="API Secret"
          dir="ltr"
        />
        <select
          value={environment}
          onChange={(e) =>
            setEnvironment(e.target.value as "sandbox" | "production")
          }
          className="block w-full rounded-xl border border-navy-200 bg-white px-3.5 h-11 text-sm text-navy-900"
        >
          <option value="sandbox">בדיקה (sandbox)</option>
          <option value="production">פרודקשן</option>
        </select>
        <FormError message={error} />
        <Button type="submit" disabled={connectMut.isPending}>
          {connectMut.isPending ? <Spinner /> : "חבר חשבונית ירוקה"}
        </Button>
      </form>
    </Card>
  );
}

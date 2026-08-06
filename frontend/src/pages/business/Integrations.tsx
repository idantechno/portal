import { useState } from "react";
import type { FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { integrationsApi } from "../../api/integrations";
import type { IntegrationProvider, IntegrationView } from "../../api/integrations";
import { greenInvoiceApi } from "../../api/greenInvoice";
import { billingApi } from "../../api/billing";
import { apiErrorMessage } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { isPlatformStaff } from "../../lib/roles";
import {
  Badge,
  Banner,
  Button,
  Card,
  FormError,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";
import { Icon, ServerIcon } from "../../components/icons";

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

  // Google integration is an exclusive-tier capability. The operator (platform
  // staff) can always connect; the backend guard is authoritative either way.
  const caps = useQuery({
    queryKey: ["billing", "capabilities", businessId],
    queryFn: () => billingApi.capabilities(businessId),
    enabled: Boolean(businessId),
  });
  const staff = isPlatformStaff(useAuthStore((s) => s.user)?.role);
  const googleAllowed = staff || (caps.data?.includes("google") ?? false);

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
      <PageHeader
        title="אינטגרציות"
        subtitle="חבר את כלי Google של העסק כדי שהסוכנים יוכלו לפעול מולם."
      />

      {connected && (
        <Banner tone="success" className="mb-4" onDismiss={clearBanner}>
          החיבור ל-{connected} בוצע בהצלחה
        </Banner>
      )}
      {error && (
        <Banner tone="danger" className="mb-4" onDismiss={clearBanner}>
          החיבור נכשל ({error}). נסה שוב.
        </Banner>
      )}

      {list.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <ProviderRow
            key={it.provider}
            it={it}
            connecting={connectMut.isPending}
            allowed={googleAllowed}
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
  allowed,
  onConnect,
  onDisconnect,
}: {
  it: IntegrationView;
  connecting: boolean;
  allowed: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = it.status === "connected";
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-navy-100 bg-cream-50 text-brand-500">
        <ServerIcon name={it.icon} size={21} />
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
      ) : !allowed ? (
        // Google connect is sold on the Exclusive tier only.
        <Badge tone="neutral" className="shrink-0">
          אקסקלוסיב
        </Badge>
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
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
          <Icon name="mail" size={17} />
        </span>
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
          <Banner tone="success" onDismiss={() => setSentTo(null)}>
            המייל נשלח אל {sentTo}
          </Banner>
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

  // Until the status resolves we don't KNOW if the account is connected — show
  // a spinner rather than flashing the "connect" form at an already-connected
  // business. A failed status check is treated the same (don't imply "not
  // connected" and invite a duplicate connect).
  if (status.isLoading || status.isError) {
    return (
      <Card className="p-6 grid place-items-center">
        {status.isError ? (
          <div className="text-sm text-navy-400">
            לא הצלחנו לבדוק את מצב החיבור כרגע. רענן את הדף לניסיון נוסף.
          </div>
        ) : (
          <Spinner />
        )}
      </Card>
    );
  }

  if (s?.connected) {
    return (
      <Card className="p-4 flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-navy-100 bg-cream-50 text-brand-500">
          <Icon name="receipt" size={21} />
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
        <Select
          value={environment}
          onChange={(e) =>
            setEnvironment(e.target.value as "sandbox" | "production")
          }
        >
          <option value="sandbox">בדיקה (sandbox)</option>
          <option value="production">פרודקשן</option>
        </Select>
        <FormError message={error} />
        <Button type="submit" disabled={connectMut.isPending}>
          {connectMut.isPending ? <Spinner /> : "חבר חשבונית ירוקה"}
        </Button>
      </form>
    </Card>
  );
}

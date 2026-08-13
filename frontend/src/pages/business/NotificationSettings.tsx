import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../../api/notifications";
import type { NotificationPreferences } from "../../api/notifications";
import { apiErrorMessage } from "../../api/client";
import {
  Button,
  Card,
  FormError,
  IconTile,
  Input,
  PageHeader,
  Spinner,
} from "../../components/ui";
import { Icon } from "../../components/icons";
import type { IconName } from "../../components/icons";
import {
  disablePush,
  enablePush,
  hasPushSubscription,
  isPushSupported,
  pushPermission,
} from "../../pwa/push";

/** A pill on/off switch — the one place channels flip. */
function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-brand-500" : "bg-navy-200"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked
            ? "translate-x-6 rtl:-translate-x-6"
            : "translate-x-1 rtl:-translate-x-1"
        }`}
      />
    </button>
  );
}

/** One channel row: icon + title/subtitle on one side, a control on the other. */
function ChannelRow({
  icon,
  title,
  subtitle,
  control,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  control: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <IconTile icon={icon} />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-navy-900">{title}</div>
          <div className="text-sm text-navy-400">{subtitle}</div>
        </div>
        <div className="shrink-0">{control}</div>
      </div>
      {children}
    </Card>
  );
}

/**
 * The owner's notification control room — which of the three reach-out channels
 * to receive on (the in-app bell is always on). Push is a per-device toggle
 * (subscribe/unsubscribe this device); email + WhatsApp are stored preferences
 * with an optional target override. Reached from the gear in the bell panel.
 */
export default function NotificationSettings() {
  const { businessId = "" } = useParams<{ businessId: string }>();

  const prefs = useQuery({
    queryKey: ["notif-prefs", businessId],
    queryFn: () => notificationsApi.preferences(businessId),
    enabled: Boolean(businessId),
  });

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto">
      <PageHeader
        eyebrow="התראות"
        title="איך לקבל התראות"
        subtitle="בחר באילו ערוצים לקבל עדכונים. אפשר לבחור כמה שרוצים — ההתראות בתוך המערכת (הפעמון) תמיד פעילות."
      />
      {prefs.isLoading || !prefs.data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        // Keyed by businessId so switching business remounts with fresh state —
        // the form seeds itself from `initial` via useState, no sync effect.
        <PreferencesForm
          key={businessId}
          businessId={businessId}
          initial={prefs.data}
        />
      )}
    </div>
  );
}

function PreferencesForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: NotificationPreferences;
}) {
  const qc = useQueryClient();
  const [emailOn, setEmailOn] = useState(initial.email);
  const [emailTo, setEmailTo] = useState(initial.emailTo ?? "");
  const [waOn, setWaOn] = useState(initial.whatsapp);
  const [waTo, setWaTo] = useState(initial.whatsappTo ?? "");
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      notificationsApi.updatePreferences(businessId, {
        email: emailOn,
        emailTo: emailTo.trim() || undefined,
        whatsapp: waOn,
        whatsappTo: waTo.trim() || undefined,
      }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["notif-prefs", businessId] });
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  // --- Push (this device) --------------------------------------------------
  const [pushState, setPushState] = useState<
    "on" | "off" | "denied" | "unsupported" | null
  >(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Awaited up front so state updates never land synchronously in-effect.
      await Promise.resolve();
      if (cancelled) return;
      if (!isPushSupported()) return setPushState("unsupported");
      if (pushPermission() === "denied") return setPushState("denied");
      const has = await hasPushSubscription();
      if (!cancelled) setPushState(has ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePush = async (next: boolean) => {
    setPushBusy(true);
    try {
      if (next) {
        const r = await enablePush(businessId);
        setPushState(
          r === "subscribed" ? "on" : r === "denied" ? "denied" : "unsupported",
        );
      } else {
        await disablePush(businessId);
        setPushState("off");
      }
    } finally {
      setPushBusy(false);
    }
  };

  const pushControl = () => {
    if (pushState === null) return <Spinner />;
    if (pushState === "unsupported")
      return <span className="text-xs text-navy-400">לא נתמך במכשיר</span>;
    if (pushState === "denied")
      return <span className="text-xs text-navy-400">חסום בדפדפן</span>;
    return (
      <Switch
        checked={pushState === "on"}
        onChange={togglePush}
        disabled={pushBusy}
        label="התראות בטלפון"
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Push — per device */}
      <ChannelRow
        icon="bell"
        title="התראות בטלפון"
        subtitle="באנר שנופל על מסך הטלפון + עיגול על האייקון (במכשיר זה)"
        control={pushControl()}
      />

      {/* Email */}
      <ChannelRow
        icon="mail"
        title="אימייל"
        subtitle="עדכון נשלח לתיבת המייל שלך"
        control={
          <Switch checked={emailOn} onChange={setEmailOn} label="התראות במייל" />
        }
      >
        {emailOn && (
          <div className="mt-3 border-t border-navy-100 pt-3">
            <Input
              type="email"
              dir="ltr"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder={initial.ownerEmail ?? "your@email.com"}
            />
            <p className="mt-1.5 text-xs text-navy-400">
              ריק = כתובת החשבון שלך ({initial.ownerEmail ?? "—"})
            </p>
          </div>
        )}
      </ChannelRow>

      {/* WhatsApp */}
      <ChannelRow
        icon="whatsapp"
        title="וואטסאפ"
        subtitle="תזכורות ועדכונים ישירות לוואטסאפ שלך"
        control={
          <Switch checked={waOn} onChange={setWaOn} label="התראות בוואטסאפ" />
        }
      >
        {waOn && (
          <div className="mt-3 border-t border-navy-100 pt-3">
            <Input
              type="tel"
              dir="ltr"
              value={waTo}
              onChange={(e) => setWaTo(e.target.value)}
              placeholder={initial.ownerPhone ?? "05X-XXXXXXX"}
            />
            <p className="mt-1.5 text-xs text-navy-400">
              ריק = המספר השמור בעסק ({initial.ownerPhone ?? "—"})
            </p>
          </div>
        )}
      </ChannelRow>

      <FormError
        message={
          save.isError ? apiErrorMessage(save.error, "השמירה נכשלה, נסה שוב") : null
        }
      />

      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && (
          <span className="flex items-center gap-1 text-sm text-teal-600">
            <Icon name="check" size={16} />
            נשמר
          </span>
        )}
        <Button onClick={() => save.mutate()} disabled={save.isPending} icon="check">
          {save.isPending ? <Spinner /> : "שמור"}
        </Button>
      </div>
    </div>
  );
}

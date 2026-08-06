import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../../api/businesses";
import { contactsApi } from "../../api/conversations";
import type {
  ContactAgentMode,
  ContactListItem,
} from "../../api/conversations";
import type { WhatsappAgentConfig } from "../../api/types";
import { Button, Card, Select, Spinner } from "../../components/ui";
import { Icon } from "../../components/icons";
import AgentScheduleSettings from "./AgentScheduleSettings";

const MODE_META: Record<
  ContactAgentMode,
  { label: string; hint: string }
> = {
  active: { label: "פעיל", hint: "עונה מיד" },
  off: { label: "כבוי", hint: "לא עונה" },
  delayed: { label: "השהיה", hint: "אתה קודם" },
};

// Mirror of the backend CONTACT_AGENT_DELAY_CHOICES.
const DELAY_OPTIONS: { value: number; label: string }[] = [
  { value: 2, label: "2 דקות" },
  { value: 3, label: "3 דקות" },
  { value: 5, label: "5 דקות" },
  { value: 10, label: "10 דקות" },
  { value: 15, label: "15 דקות" },
  { value: 30, label: "30 דקות" },
  { value: 45, label: "45 דקות" },
  { value: 60, label: "שעה" },
  { value: 120, label: "שעתיים" },
  { value: 180, label: "3 שעות" },
  { value: 300, label: "5 שעות" },
];

const SCHEDULE_LABEL: Record<string, string> = {
  always: "תמיד פעיל",
  scheduled: "מתוזמן",
  off: "כבוי",
};

export default function ChatAgent({ businessId }: { businessId: string }) {
  const navigate = useNavigate();
  const [showSchedule, setShowSchedule] = useState(false);

  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });

  const cfg: WhatsappAgentConfig = biz.data?.whatsappAgent ?? { mode: "always" };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
            <Icon name="chat" size={24} />
          </div>
          <div>
            <h1 className="font-display text-xl leading-tight">סוכן צ׳אט</h1>
            <p className="text-sm text-navy-500">
              מענה אוטומטי ללקוחות בוואטסאפ ובווידג׳ט האתר.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          icon="chat"
          onClick={() => navigate(`/app/businesses/${businessId}/inbox`)}
        >
          עבור לשיחות
        </Button>
      </div>

      {/* General settings */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="settings" size={18} className="text-navy-500" />
          <h2 className="font-display text-base">הגדרות כלליות</h2>
        </div>
        <p className="mb-4 text-sm text-navy-400">
          איך הסוכן מתנהל בכל השיחות כברירת מחדל — מתי הוא עונה, החזרה אוטומטית
          אליך, ומודעות ליומן.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-navy-100 px-3.5 py-2.5">
            <div className="text-[11px] text-navy-400">מצב מענה</div>
            <div className="text-sm font-medium text-navy-900">
              {SCHEDULE_LABEL[cfg.mode] ?? cfg.mode}
            </div>
          </div>
          {cfg.busyMode && (
            <div className="rounded-xl border border-navy-100 px-3.5 py-2.5">
              <div className="text-[11px] text-navy-400">מודעות ליומן</div>
              <div className="text-sm font-medium text-navy-900">פעילה</div>
            </div>
          )}
          {typeof cfg.autoReturnHours === "number" &&
            cfg.autoReturnHours > 0 && (
              <div className="rounded-xl border border-navy-100 px-3.5 py-2.5">
                <div className="text-[11px] text-navy-400">
                  החזרה אוטומטית
                </div>
                <div className="text-sm font-medium text-navy-900">
                  אחרי {cfg.autoReturnHours} שעות
                </div>
              </div>
            )}
          <Button
            variant="secondary"
            icon="settings"
            className="ms-auto"
            onClick={() => setShowSchedule(true)}
          >
            ערוך הגדרות
          </Button>
        </div>
      </Card>

      {/* Per-contact settings */}
      <PerContactSection businessId={businessId} />

      {/* Templates */}
      <TemplatesSection />

      {showSchedule && (
        <AgentScheduleSettings onClose={() => setShowSchedule(false)} />
      )}
    </div>
  );
}

function PerContactSection({ businessId }: { businessId: string }) {
  const customers = useQuery({
    queryKey: ["contacts", businessId, "customer"],
    queryFn: () => contactsApi.list(businessId, "customer"),
    enabled: Boolean(businessId),
  });
  const leads = useQuery({
    queryKey: ["contacts", businessId, "lead"],
    queryFn: () => contactsApi.list(businessId, "lead"),
    enabled: Boolean(businessId),
  });

  const loading = customers.isLoading || leads.isLoading;
  const all = [...(customers.data ?? []), ...(leads.data ?? [])].sort((a, b) => {
    const av = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bv = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return bv - av;
  });

  return (
    <Card className="mb-6 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="leads" size={18} className="text-navy-500" />
        <h2 className="font-display text-base">הגדרות לפי איש קשר</h2>
      </div>
      <p className="mb-4 text-sm text-navy-400">
        לכל איש קשר בנפרד: הסוכן <b>פעיל</b> (עונה מיד), <b>כבוי</b> (אתה מטפל),
        או <b>השהיה</b> (נותן לך חלון לענות ואם לא ענית — הוא נכנס בעדינות).
      </p>

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {!loading && all.length === 0 && (
        <p className="py-6 text-center text-sm text-navy-400">
          אין עדיין אנשי קשר. ברגע שמישהו יכתוב, הוא יופיע כאן.
        </p>
      )}
      {!loading && all.length > 0 && (
        <div className="max-h-[440px] space-y-2 overflow-y-auto pe-1">
          {all.map((c) => (
            <ContactModeRow key={c.id} businessId={businessId} contact={c} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ContactModeRow({
  businessId,
  contact,
}: {
  businessId: string;
  contact: ContactListItem;
}) {
  const qc = useQueryClient();
  const [delay, setDelay] = useState<number>(contact.agentDelayMinutes ?? 10);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contacts", businessId] });
    qc.invalidateQueries({ queryKey: ["conversations", businessId] });
  };

  const save = useMutation({
    mutationFn: (patch: {
      agentMode: ContactAgentMode;
      agentDelayMinutes: number | null;
    }) => contactsApi.update(businessId, contact.id, patch),
    onSuccess: invalidate,
  });

  const mode = contact.agentMode ?? "active";
  const name = contact.displayName?.trim() || contact.phone || "איש קשר";

  const setMode = (next: ContactAgentMode) =>
    save.mutate({
      agentMode: next,
      agentDelayMinutes: next === "delayed" ? delay : null,
    });

  return (
    <div className="rounded-xl border border-navy-100 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-navy-900">
            {name}
          </div>
          <div className="text-[11px] text-navy-400">
            {contact.status === "customer" ? "לקוח" : "ליד"}
          </div>
        </div>
        <div className="flex gap-1">
          {(Object.keys(MODE_META) as ContactAgentMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              disabled={save.isPending}
              title={MODE_META[m].hint}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                mode === m
                  ? "bg-brand-500 text-white"
                  : "bg-navy-50 text-navy-500 hover:bg-navy-100"
              }`}
            >
              {MODE_META[m].label}
            </button>
          ))}
        </div>
      </div>
      {mode === "delayed" && (
        <div className="mt-2.5 flex items-center gap-2 border-t border-navy-100 pt-2.5">
          <span className="text-xs text-navy-400">חלון המתנה:</span>
          <Select
            value={delay}
            onChange={(e) => {
              const v = Number(e.target.value);
              setDelay(v);
              save.mutate({ agentMode: "delayed", agentDelayMinutes: v });
            }}
            className="w-auto"
          >
            {DELAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}

const TEMPLATES: { name: string; title: string; desc: string }[] = [
  {
    name: "reminder",
    title: "תזכורת",
    desc: "נשלחת אוטומטית אליך (ולפעמים ללקוח) כשמגיע מועד של תזכורת או פגישה.",
  },
  {
    name: "appointment_booked",
    title: "אישור קביעת פגישה",
    desc: "נשלחת כשנקבעת פגישה — מאשרת את היום והשעה.",
  },
];

function TemplatesSection() {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="doc" size={18} className="text-navy-500" />
        <h2 className="font-display text-base">טמפלייטים</h2>
      </div>
      <p className="mb-4 text-sm text-navy-400">
        הודעות מוכנות ומאושרות של וואטסאפ שהסוכן שולח אוטומטית. הן פעילות כל עוד
        חיבור הוואטסאפ פעיל.
      </p>
      <div className="space-y-2.5">
        {TEMPLATES.map((t) => (
          <div
            key={t.name}
            className="flex items-start gap-3 rounded-xl border border-navy-100 p-3.5"
          >
            <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
              <Icon name="whatsapp" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-navy-900">
                  {t.title}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-teal-200">
                  <Icon name="check-circle" size={12} />
                  פעילה
                </span>
              </div>
              <div className="mt-0.5 text-xs text-navy-400">{t.desc}</div>
              <div className="mt-1 font-mono text-[11px] text-navy-300">
                {t.name}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-navy-300">
        טמפלייטים מותאמים לכל לקוח בנפרד — בהמשך.
      </p>
    </Card>
  );
}

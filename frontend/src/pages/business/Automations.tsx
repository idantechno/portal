import { useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { automationsApi } from "../../api/automations";
import type {
  AutomationActionType,
  AutomationRule,
} from "../../api/automations";
import { agentsApi } from "../../api/agents";
import { businessesApi } from "../../api/businesses";
import { useAuthStore } from "../../store/auth";
import { isPlatformStaff } from "../../lib/roles";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";
import { Icon } from "../../components/icons";
import type { IconName } from "../../components/icons";

const RUN_AGENT_KEYS = [
  "marketing",
  "analytics",
  "accounting",
  "sales",
  "crm",
];

const TRIGGER_LABEL: Record<string, string> = {
  "lead.created": "ליד חדש נוצר",
  "message.received": "הודעה נכנסת מלקוח",
  "document.signed": "מסמך נחתם",
  "task.created": "משימה נוצרה",
};
const ACTION_LABEL: Record<AutomationActionType, string> = {
  create_task: "צור משימה",
  notify: "שלח התראה",
  run_agent: "הפעל סוכן",
};

export default function Automations() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const user = useAuthStore((s) => s.user);

  // Operator = platform staff, OR an operator who entered this business via
  // staff privilege (viaPlatformStaff). Only the operator manages rules; the
  // owner (client) sees a request-driven experience.
  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });
  const isOperator =
    isPlatformStaff(user?.role) || (biz.data?.viaPlatformStaff ?? false);

  if (isOperator) return <OperatorAutomations businessId={businessId} />;
  return <ClientAutomations businessId={businessId} />;
}

/** A single rule row's plain-Hebrew "when → then" description. */
function ruleSummary(rule: AutomationRule) {
  const trigger = TRIGGER_LABEL[rule.trigger] ?? rule.trigger;
  const actions = rule.actions
    .map((a) => ACTION_LABEL[a.type] ?? a.type)
    .join(", ");
  return { trigger, actions };
}

/** On/off toggle switch, shared by both views. */
function ToggleSwitch({
  on,
  onClick,
}: {
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
        on ? "bg-teal-400" : "bg-navy-200"
      }`}
      aria-label={on ? "כבה" : "הפעל"}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          on ? "start-0.5" : "end-0.5"
        }`}
      />
    </button>
  );
}

/* ---------------------------------------------------------------- Operator */

function OperatorAutomations({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const rules = useQuery({
    queryKey: ["automations", businessId],
    queryFn: () => automationsApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["automations", businessId] });

  const toggleMut = useMutation({
    mutationFn: (rule: AutomationRule) =>
      automationsApi.setEnabled(businessId, rule.id, !rule.enabled),
    onSuccess: invalidate,
  });
  const testMut = useMutation({
    mutationFn: (id: string) => automationsApi.test(businessId, id),
    onSuccess: invalidate,
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => automationsApi.remove(businessId, id),
    onSuccess: invalidate,
  });

  const items = rules.data ?? [];

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="אוטומציות"
        subtitle='"כשקורה X — תעשה Y". הרקמה שמחברת בין כל חלקי המערכת.'
        action={
          !showForm ? (
            <Button icon="plus" onClick={() => setShowForm(true)}>
              אוטומציה חדשה
            </Button>
          ) : undefined
        }
      />

      {showForm && (
        <RuleForm
          businessId={businessId}
          onDone={() => {
            setShowForm(false);
            invalidate();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {rules.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {!rules.isLoading && items.length === 0 && !showForm && (
        <Card>
          <EmptyState
            icon="bolt"
            title="אין אוטומציות עדיין"
            text='צור כלל ראשון, למשל "ליד חדש ← צור משימת מעקב".'
            action={
              <Button icon="plus" onClick={() => setShowForm(true)}>
                צור אוטומציה
              </Button>
            }
          />
        </Card>
      )}

      <div className="space-y-3">
        {items.map((rule) => {
          const { trigger, actions } = ruleSummary(rule);
          return (
            <Card key={rule.id} className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <ToggleSwitch
                  on={rule.enabled}
                  onClick={() => toggleMut.mutate(rule)}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy-900 text-sm">
                    {rule.name}
                  </div>
                  <div className="text-xs text-navy-500 mt-0.5 flex flex-wrap items-center gap-1">
                    <span>
                      כש<span className="font-medium">{trigger}</span>
                    </span>
                    <Icon
                      name="arrow-end"
                      size={13}
                      className="shrink-0 text-navy-400"
                    />
                    <span>{actions}</span>
                  </div>
                </div>
                <span className="text-xs text-navy-400 shrink-0">
                  הופעל {rule.runCount}×
                </span>
                <button
                  onClick={() => testMut.mutate(rule.id)}
                  className="text-xs text-brand-600 hover:text-brand-700 shrink-0"
                >
                  בדיקה
                </button>
                <button
                  onClick={() => removeMut.mutate(rule.id)}
                  className="text-navy-300 hover:text-coral-500 shrink-0"
                  aria-label="מחק"
                >
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Client */

const REQUEST_EXAMPLES: { icon: IconName; text: string }[] = [
  {
    icon: "calendar",
    text: "כשלקוח חדש קובע תור ראשון — לשלוח לו הודעת ברוכים הבאים.",
  },
  {
    icon: "chat",
    text: "כשמגיעה הודעה עם המילה \"מחיר\" — להשיב אוטומטית עם קישור למחירון.",
  },
  {
    icon: "check-circle",
    text: "כשמסמך נחתם — לפתוח לי משימת מעקב ליום שאחרי.",
  },
];

function ClientAutomations({ businessId }: { businessId: string }) {
  const qc = useQueryClient();

  const rules = useQuery({
    queryKey: ["automations", businessId],
    queryFn: () => automationsApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const toggleMut = useMutation({
    mutationFn: (rule: AutomationRule) =>
      automationsApi.setEnabled(businessId, rule.id, !rule.enabled),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["automations", businessId] }),
  });

  const items = rules.data ?? [];

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="אוטומציות"
        subtitle="פעולות שהמערכת עושה בשבילך אוטומטית — כשקורה משהו, קורה משהו אחר."
      />

      {/* Section 1 — the business's existing automations (toggle only). */}
      <section>
        <h2 className="font-display text-lg text-navy-900 mb-3">
          האוטומציות שלך
        </h2>

        {rules.isLoading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}

        {!rules.isLoading && items.length === 0 && (
          <Card>
            <EmptyState
              icon="bolt"
              title="עדיין אין לך אוטומציות"
              text="בקש אחת למטה — נגדיר אותה עבורך ותוכל להפעיל בלחיצה."
            />
          </Card>
        )}

        <div className="space-y-3">
          {items.map((rule) => {
            const { trigger, actions } = ruleSummary(rule);
            return (
              <Card key={rule.id} className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <ToggleSwitch
                    on={rule.enabled}
                    onClick={() => toggleMut.mutate(rule)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-navy-900 text-sm">
                      {rule.name}
                    </div>
                    <div className="text-xs text-navy-500 mt-0.5 flex flex-wrap items-center gap-1">
                      <span>
                        כש<span className="font-medium">{trigger}</span>
                      </span>
                      <Icon
                        name="arrow-end"
                        size={13}
                        className="shrink-0 text-navy-400"
                      />
                      <span>{actions}</span>
                    </div>
                  </div>
                  <Badge tone={rule.enabled ? "teal" : "neutral"}>
                    {rule.enabled ? "פעיל" : "כבוי"}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Section 2 — request a new automation. */}
      <RequestSection businessId={businessId} />
    </div>
  );
}

function RequestSection({ businessId }: { businessId: string }) {
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("");
  const [subject, setSubject] = useState("");

  const requestMut = useMutation({
    mutationFn: () =>
      automationsApi.requestAutomation(businessId, {
        description: description.trim(),
        trigger: trigger.trim() || undefined,
        subject: subject.trim() || undefined,
      }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (description.trim()) requestMut.mutate();
  }

  return (
    <section>
      <h2 className="font-display text-lg text-navy-900 mb-1">
        בקשת אוטומציה חדשה
      </h2>
      <p className="text-sm text-navy-500 mb-4">
        תאר במילים שלך מה תרצה שיקרה אוטומטית, ואנחנו נגדיר את זה עבורך. הנה כמה
        דוגמאות נפוצות:
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {REQUEST_EXAMPLES.map((ex) => (
          <Card key={ex.text} className="p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                <Icon name={ex.icon} size={18} />
              </span>
              <p className="text-sm text-navy-700 leading-relaxed">{ex.text}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        {requestMut.isSuccess ? (
          <Banner tone="success">
            קיבלנו! נגדיר את האוטומציה ונחזור אליך. תוכל לשלוח בקשה נוספת מתי
            שתרצה.
            <div className="mt-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setDescription("");
                  setTrigger("");
                  setSubject("");
                  requestMut.reset();
                }}
              >
                בקשה נוספת
              </Button>
            </div>
          </Banner>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-800 mb-1.5">
                תאר במילים שלך איזו אוטומציה תרצה
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="לדוגמה: כשלקוח חדש כותב לי בוואטסאפ, לשלוח לו הודעה עם שעות הפעילות ולפתוח לי משימה להתקשר אליו."
                rows={4}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy-800 mb-1.5">
                  מתי זה צריך לקרות? (אופציונלי)
                </label>
                <Input
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  placeholder="לדוגמה: כשמגיעה הודעה חדשה"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-800 mb-1.5">
                  על מי / מה זה חל? (אופציונלי)
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="לדוגמה: מספר טלפון מסוים, לקוח, מסמך"
                />
              </div>
            </div>

            {requestMut.isError && (
              <Banner tone="danger">
                משהו השתבש בשליחת הבקשה. נסה שוב בעוד רגע.
              </Banner>
            )}

            <Button
              type="submit"
              icon="send"
              disabled={!description.trim() || requestMut.isPending}
            >
              {requestMut.isPending ? <Spinner /> : "שלח בקשה"}
            </Button>
          </form>
        )}
      </Card>
    </section>
  );
}

/* -------------------------------------------------------- Operator RuleForm */

function RuleForm({
  businessId,
  onDone,
  onCancel,
}: {
  businessId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("lead.created");
  const [actionType, setActionType] = useState<AutomationActionType>(
    "create_task",
  );
  const [actionTitle, setActionTitle] = useState("");
  const [agentKey, setAgentKey] = useState("marketing");
  const [instruction, setInstruction] = useState("");

  const agents = useQuery({ queryKey: ["me", "agents"], queryFn: agentsApi.mine });
  const runnableAgents = (agents.data ?? []).filter((a) =>
    RUN_AGENT_KEYS.includes(a.key),
  );

  const createMut = useMutation({
    mutationFn: () =>
      automationsApi.create(businessId, {
        name,
        trigger,
        enabled: true,
        actions: [
          {
            type: actionType,
            params:
              actionType === "run_agent"
                ? { agentKey, instruction }
                : { title: actionTitle || name },
          },
        ],
      }),
    onSuccess: onDone,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) createMut.mutate();
  }

  return (
    <Card className="p-5 mb-6">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-navy-800 mb-1.5">
            שם הכלל
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: מעקב אחרי ליד חדש"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-navy-800 mb-1.5">
              כאשר (טריגר)
            </label>
            <Select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {Object.entries(TRIGGER_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-800 mb-1.5">
              אז (פעולה)
            </label>
            <Select
              value={actionType}
              onChange={(e) =>
                setActionType(e.target.value as AutomationActionType)
              }
            >
              {Object.entries(ACTION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {actionType === "run_agent" ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-navy-800 mb-1.5">
                איזה סוכן להפעיל
              </label>
              <Select value={agentKey} onChange={(e) => setAgentKey(e.target.value)}>
                {runnableAgents.length === 0 && (
                  <option value="marketing">סוכן שיווק</option>
                )}
                {runnableAgents.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-800 mb-1.5">
                הוראה לסוכן (אופציונלי)
              </label>
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="לדוגמה: נסח הודעת מעקב ללקוח. אם ריק — הסוכן יפעל לפי ההקשר של האירוע."
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-navy-800 mb-1.5">
              {actionType === "notify" ? "כותרת ההתראה" : "כותרת המשימה"}
            </label>
            <Input
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
              placeholder="טקסט שיופיע כשהכלל מופעל"
            />
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? <Spinner /> : "צור אוטומציה"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            ביטול
          </Button>
        </div>
      </form>
    </Card>
  );
}

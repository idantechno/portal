import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import type { AgentDefinition } from "../../api/types";
import { apiErrorMessage } from "../../api/client";
import { agentRoute } from "../../lib/agentRoutes";
import { Button, Card, FormError, Spinner, Textarea } from "../../components/ui";

// Agents with their own dedicated screen — clicking their card navigates there.
// Every other (generative) agent is handled inline in this hub. This page is
// the single place that lists ALL of the business's agents.
const DEDICATED_KEYS = new Set([
  "main",
  "chat",
  "documents",
  "ideas",
  "designer",
  "reminders",
]);

const PLACEHOLDER: Record<string, string> = {
  marketing: "לדוגמה: כתוב 3 פוסטים לאינסטגרם על מבצע סוף עונה.",
  analytics: "לדוגמה: יש לי 40 לידים החודש ו-8 נסגרו. מה כדאי לשפר?",
  accounting: "לדוגמה: נסח תזכורת תשלום ללקוח שמאחר בשבועיים.",
  sales: "לדוגמה: כתוב הודעת מעקב לליד שביקש הצעת מחיר ולא חזר.",
  crm: "לדוגמה: סכם את הלקוח הזה והצע תיוג: ...",
  quote: "לדוגמה: בנה הצעת מחיר לעיצוב לוגו + מיתוג, 3 סבבי תיקונים.",
  orchestrator: "תאר מה אתה צריך, ואנתב את זה לסוכן הנכון.",
};

export default function AgentStudio() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const navigate = useNavigate();
  const [active, setActive] = useState<AgentDefinition | null>(null);
  const [instruction, setInstruction] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agents = useQuery({
    queryKey: ["business", businessId, "agents"],
    queryFn: () => agentsApi.forBusiness(businessId),
    enabled: Boolean(businessId),
  });

  const runMut = useMutation({
    mutationFn: () => agentsApi.run(businessId, active!.key, instruction),
    onSuccess: (r) => setOutput(r.text),
    onError: (err) => setError(apiErrorMessage(err, "ההרצה נכשלה")),
  });

  const allAgents = agents.data ?? [];

  function pick(agent: AgentDefinition) {
    setActive(agent);
    setInstruction("");
    setOutput(null);
    setError(null);
  }

  function onCardClick(agent: AgentDefinition) {
    if (DEDICATED_KEYS.has(agent.key)) {
      const to = agentRoute(agent.key, businessId);
      if (to) navigate(to);
      return;
    }
    pick(agent);
  }

  function run() {
    setError(null);
    setOutput(null);
    if (instruction.trim()) runMut.mutate();
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900 mb-1">הסוכנים שלך</h1>
        <p className="text-navy-500 text-sm">
          כל הסוכנים של העסק במקום אחד — בחר סוכן כדי להתחיל.
        </p>
      </header>

      {agents.isLoading && <div className="text-navy-400 text-sm">טוען...</div>}
      {!agents.isLoading && allAgents.length === 0 && (
        <Card className="p-12 text-center text-navy-400">
          עדיין לא הוקצו לעסק סוכנים. פנה למנהל המערכת כדי להפעיל.
        </Card>
      )}

      {allAgents.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {allAgents.map((agent) => (
            <button
              key={agent.key}
              onClick={() => onCardClick(agent)}
              className={`relative text-start rounded-2xl border p-4 transition-all ${
                active?.key === agent.key
                  ? "border-brand-400 bg-brand-50 shadow-[0_12px_32px_-20px_rgba(1,20,39,0.4)]"
                  : "border-navy-100 bg-white hover:border-brand-200 hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="text-2xl mb-2">{agent.icon}</div>
                {DEDICATED_KEYS.has(agent.key) && (
                  <span className="text-brand-400 text-lg rtl:rotate-180">→</span>
                )}
              </div>
              <div className="font-semibold text-navy-900 text-sm mb-0.5">
                {agent.name}
              </div>
              <div className="text-xs text-navy-400">{agent.description}</div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{active.icon}</span>
            <span className="font-semibold text-navy-900">{active.name}</span>
          </div>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={PLACEHOLDER[active.key] ?? "תאר מה אתה צריך..."}
            className="min-h-28"
          />
          <FormError message={error} />
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={run} disabled={runMut.isPending}>
              {runMut.isPending ? <Spinner /> : "הפעל סוכן"}
            </Button>
            {runMut.isPending && (
              <span className="text-sm text-navy-400">הסוכן עובד...</span>
            )}
          </div>

          {output && (
            <div className="mt-5 border-t border-navy-100 pt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-brand-600">
                  התוצר
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(output)}
                  className="text-xs text-navy-400 hover:text-navy-700"
                >
                  העתק
                </button>
              </div>
              <div className="whitespace-pre-wrap text-sm text-navy-800 leading-relaxed bg-cream-50 rounded-xl p-4 border border-navy-100">
                {output}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

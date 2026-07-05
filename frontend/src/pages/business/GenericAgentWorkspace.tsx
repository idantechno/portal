import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import {
  type AgentSuggestion,
  type ChatTurn,
  workspaceAgentsApi,
} from "../../api/workspaceAgents";
import { WORKSPACE_AGENT_UI } from "../../lib/workspaceAgents";
import { agentRoute } from "../../lib/agentRoutes";
import { Button, Card, FormError, Spinner } from "../../components/ui";

interface UIMessage extends ChatTurn {
  createdAt: number;
}

export default function GenericAgentWorkspace({
  businessId,
  agentKey,
  name,
  icon,
}: {
  businessId: string;
  agentKey: string;
  name: string;
  icon: string;
}) {
  const cfg = WORKSPACE_AGENT_UI[agentKey];
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const chat = useMutation({
    mutationFn: (history: ChatTurn[]) =>
      workspaceAgentsApi.chat(businessId, agentKey, history),
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply, createdAt: Date.now() },
      ]);
      setSuggestions(result.suggestions ?? []);
      if (result.changed) {
        // A tool wrote real data — refresh the screens that show it.
        void qc.invalidateQueries({ queryKey: ["tasks", businessId] });
        void qc.invalidateQueries({ queryKey: ["leads", businessId] });
        void qc.invalidateQueries({ queryKey: ["billing", "invoices", businessId] });
      }
    },
    onError: (err) => setError(apiErrorMessage(err, "אירעה שגיאה. נסה שוב.")),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send(content: string) {
    const text = content.trim();
    if (!text || chat.isPending) return;
    setError(null);
    const nextHistory: ChatTurn[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user", content: text },
    ];
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, createdAt: Date.now() },
    ]);
    setDraft("");
    chat.mutate(nextHistory);
  }

  function reset() {
    setMessages([]);
    setSuggestions([]);
    setError(null);
  }

  if (!cfg) {
    return (
      <div className="p-8 text-center text-navy-400">
        הסוכן הזה עדיין לא זמין.
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col h-full min-h-0">
        <header className="px-4 sm:px-8 py-5 border-b border-neutral-200 bg-white flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <span className="text-2xl shrink-0" aria-hidden>
              {icon}
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-navy-900 truncate">
                {name}
              </h1>
              <p className="text-sm text-neutral-500 truncate">{cfg.subtitle}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={reset}
          >
            שיחה חדשה
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4">
          {messages.length === 0 && !chat.isPending && (
            <EmptyState icon={icon} title={cfg.emptyTitle} text={cfg.emptyText} />
          )}
          {messages.map((m, i) => (
            <Message key={i} message={m} />
          ))}
          {chat.isPending && (
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <Spinner /> הסוכן חושב...
            </div>
          )}

          {suggestions.length > 0 && !chat.isPending && (
            <div className="flex flex-wrap gap-2 pt-1">
              {suggestions.map((s) => {
                const to = agentRoute(s.key, businessId);
                if (!to) return null;
                return (
                  <button
                    key={s.key}
                    onClick={() => navigate(to)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
                  >
                    ← פתח: {s.name}
                  </button>
                );
              })}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="border-t border-neutral-200 bg-white px-4 sm:px-8 py-4"
        >
          <FormError message={error} />
          <div className="flex gap-2 items-end mt-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              disabled={chat.isPending}
              rows={2}
              placeholder={cfg.placeholder}
              className="flex-1 min-w-0 block rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none resize-none"
            />
            <Button
              type="submit"
              disabled={!draft.trim() || chat.isPending}
              size="md"
              className="shrink-0"
            >
              שלח
            </Button>
          </div>
        </form>
      </div>

      <aside className="hidden lg:flex flex-col border-s border-neutral-200 bg-neutral-50 overflow-y-auto p-5 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">
            פעולות מהירות
          </h2>
          <div className="flex flex-col gap-2">
            {cfg.quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={() => send(qa.prompt)}
                disabled={chat.isPending}
                className="text-start rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-navy-800 hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50 transition-colors"
              >
                {qa.label}
              </button>
            ))}
          </div>
        </div>

        {cfg.related && (
          <div>
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">
              מסך קשור
            </h2>
            <Link
              to={`/app/businesses/${businessId}/${cfg.related.to}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-brand-700 hover:bg-brand-50 transition-colors"
            >
              {cfg.related.label} ←
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-se-sm bg-brand-600 text-white px-4 py-3 text-sm"
            : "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-ss-sm bg-white border border-neutral-200 text-neutral-900 px-4 py-3 text-sm shadow-sm"
        }
      >
        <div className="whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <Card className="p-8 text-center text-neutral-600 max-w-lg mx-auto">
      <div className="text-2xl mb-3" aria-hidden>
        {icon}
      </div>
      <h2 className="text-base font-semibold mb-2 text-neutral-900">{title}</h2>
      <p className="text-sm">{text}</p>
    </Card>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import {
  type AgentSuggestion,
  type ChatTurn,
  mainApi,
} from "../../api/main";
import { agentRoute } from "../../lib/agentRoutes";
import { Button, Card, FormError, Spinner } from "../../components/ui";

interface UIMessage extends ChatTurn {
  createdAt: number;
  suggestions?: AgentSuggestion[];
  ticketCreated?: boolean;
}

export default function MainAgent({ businessId }: { businessId: string }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const chat = useMutation({
    mutationFn: (history: ChatTurn[]) => mainApi.chat(businessId, history),
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          createdAt: Date.now(),
          suggestions: result.suggestions,
          ticketCreated: result.ticketCreated,
        },
      ]);
    },
    onError: (err) => setError(apiErrorMessage(err, "אירעה שגיאה. נסה שוב.")),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const content = draft.trim();
    if (!content || chat.isPending) return;
    const next: UIMessage = { role: "user", content, createdAt: Date.now() };
    const nextHistory: ChatTurn[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user", content },
    ];
    setMessages((prev) => [...prev, next]);
    setDraft("");
    chat.mutate(nextHistory);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-8 py-5 border-b border-neutral-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">הסוכן הראשי</h1>
          <p className="text-sm text-neutral-500">
            לא בטוח לאן ללכת? ספר לי מה אתה צריך ואני אכוון אותך.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setMessages([]);
            setError(null);
          }}
        >
          שיחה חדשה
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {messages.length === 0 && !chat.isPending && <EmptyState />}
        {messages.map((m, i) => (
          <Message key={i} message={m} businessId={businessId} />
        ))}
        {chat.isPending && (
          <div className="flex items-center gap-2 text-neutral-500 text-sm">
            <Spinner /> הסוכן חושב...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSend}
        className="border-t border-neutral-200 bg-white px-8 py-4"
      >
        <FormError message={error} />
        <div className="flex gap-2 items-end mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend(e);
              }
            }}
            disabled={chat.isPending}
            rows={2}
            placeholder="לדוגמה: 'אני רוצה להוציא תפריט מעוצב חדש' או 'משהו לא עובד לי בווידג׳ט'."
            className="flex-1 block rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none resize-none"
          />
          <Button type="submit" disabled={!draft.trim() || chat.isPending} size="md">
            שלח
          </Button>
        </div>
      </form>
    </div>
  );
}

function Message({
  message,
  businessId,
}: {
  message: UIMessage;
  businessId: string;
}) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 text-white px-4 py-3 text-sm"
            : "max-w-[80%] rounded-2xl rounded-tl-sm bg-white border border-neutral-200 text-neutral-900 px-4 py-3 text-sm shadow-sm"
        }
      >
        <div className="whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.suggestions.map((s) => {
              const to = agentRoute(s.key, businessId);
              if (!to) return null;
              return (
                <Link
                  key={s.key}
                  to={to}
                  className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-brand-800 hover:bg-brand-100 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{s.name}</div>
                    <div className="text-xs text-brand-700/80 truncate">
                      {s.reason}
                    </div>
                  </div>
                  <span className="text-brand-500 shrink-0 rtl:rotate-180">→</span>
                </Link>
              );
            })}
          </div>
        )}
        {message.ticketCreated && (
          <div className="mt-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 text-xs">
            ✓ הפנייה נשלחה לצוות Portal Studio.
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="p-8 text-center text-neutral-600 max-w-lg mx-auto">
      <div className="text-2xl mb-3">🧭</div>
      <h2 className="text-base font-semibold mb-2 text-neutral-900">
        שלום — אני הסוכן הראשי
      </h2>
      <p className="text-sm mb-3">
        אני מכיר את כל הסוכנים והכלים במערכת. ספר לי מה אתה רוצה להשיג ואני אכוון
        אותך לסוכן הנכון, אסביר איך להשתמש בו, ואם משהו תקוע — אעביר פנייה לצוות.
      </p>
      <p className="text-xs text-neutral-500">
        דוגמה: "אני צריך הצעת מחיר ללקוח" או "איך אני מחבר וואטסאפ?"
      </p>
    </Card>
  );
}

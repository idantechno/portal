import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import {
  type ChatTurn,
  type Idea,
  type IdeaStatus,
  ideasApi,
} from "../../api/ideas";
import { Button, Card, FormError, Spinner } from "../../components/ui";
import { Icon } from "../../components/icons";

interface UIMessage extends ChatTurn {
  createdAt: number;
  saved?: Idea[];
}

const STATUS_LABEL: Record<IdeaStatus, string> = {
  seed: "רעיון גולמי",
  shaping: "בעיצוב",
  developed: "פותח",
};

const STATUS_TONE: Record<IdeaStatus, string> = {
  seed: "bg-neutral-100 text-neutral-600",
  shaping: "bg-brand-100 text-brand-700",
  developed: "bg-teal-100 text-teal-700",
};

export default function IdeasAgent({ businessId }: { businessId: string }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  const ideas = useQuery({
    queryKey: ["ideas", businessId],
    queryFn: () => ideasApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const chat = useMutation({
    mutationFn: (history: ChatTurn[]) => ideasApi.chat(businessId, history),
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          createdAt: Date.now(),
          saved: result.saved,
        },
      ]);
      if (result.saved.length > 0) void ideas.refetch();
    },
    onError: (err) => setError(apiErrorMessage(err, "אירעה שגיאה. נסה שוב.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => ideasApi.remove(businessId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ideas", businessId] });
    },
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

  const onStartNew = () => {
    setMessages([]);
    setError(null);
  };

  // Click a saved idea in the sidebar to reopen it — sends a message that asks
  // the agent to continue developing that specific idea (it's in the agent's
  // context, so it picks the right one and builds on it).
  const openIdea = (idea: Idea) => {
    if (chat.isPending) return;
    setError(null);
    const opener = `בוא נחזור לרעיון "${idea.title}"${
      idea.summary ? ` (${idea.summary})` : ""
    } — אני רוצה להמשיך לפתח אותו.`;
    const nextHistory: ChatTurn[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user", content: opener },
    ];
    setMessages((prev) => [
      ...prev,
      { role: "user", content: opener, createdAt: Date.now() },
    ]);
    chat.mutate(nextHistory);
  };

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col h-full min-h-0">
        <header className="px-4 sm:px-8 py-5 border-b border-neutral-200 bg-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">סוכן רעיונות</h1>
            <p className="text-sm text-neutral-500">
              זרוק לי רעיון או מחשבה — אשמור, אלטש ואעזור לפתח אותו למהלך.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="shrink-0" onClick={onStartNew}>
            שיחה חדשה
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4">
          {messages.length === 0 && !chat.isPending && <EmptyState />}
          {messages.map((m, i) => (
            <Message key={i} message={m} />
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
                  onSend(e);
                }
              }}
              disabled={chat.isPending}
              rows={2}
              placeholder="לדוגמה: 'חשבתי שאולי כדאי להוציא ניוזלטר חודשי ללקוחות עם טיפ אחד וסיפור קצר.'"
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

      <aside className="hidden lg:block border-s border-neutral-200 bg-neutral-50 overflow-y-auto p-5">
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">
          הרעיונות שלי
        </h2>
        {ideas.isLoading && (
          <div className="text-sm text-neutral-500">טוען...</div>
        )}
        {(ideas.data ?? []).length === 0 && !ideas.isLoading && (
          <div className="text-sm text-neutral-500">אין רעיונות עדיין.</div>
        )}
        <ul className="space-y-2">
          {(ideas.data ?? []).map((idea) => (
            <IdeaListItem
              key={idea.id}
              idea={idea}
              onOpen={() => openIdea(idea)}
              onRemove={() => remove.mutate(idea.id)}
              removing={remove.isPending && remove.variables === idea.id}
            />
          ))}
        </ul>
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
        {message.saved && message.saved.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.saved.map((idea) => (
              <SavedIdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: IdeaStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function SavedIdeaCard({ idea }: { idea: Idea }) {
  return (
    <div className="rounded-lg bg-white text-neutral-900 border border-neutral-200 p-3 text-xs">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon name="idea" size={15} className="text-brand-500" />
          {idea.title}
        </span>
        <StatusPill status={idea.status} />
      </div>
      {idea.summary && (
        <div className="text-neutral-600 leading-relaxed">{idea.summary}</div>
      )}
    </div>
  );
}

function IdeaListItem({
  idea,
  onOpen,
  onRemove,
  removing,
}: {
  idea: Idea;
  onOpen: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <li className="bg-white border border-neutral-200 rounded-lg p-3 hover:border-brand-300 transition-colors">
      <button type="button" onClick={onOpen} className="w-full text-start group">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-semibold leading-snug group-hover:text-brand-700">
            {idea.title}
          </span>
          <StatusPill status={idea.status} />
        </div>
        {idea.summary && (
          <p className="text-[11px] text-neutral-500 leading-relaxed mb-2">
            {idea.summary}
          </p>
        )}
      </button>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onOpen}
          className="-ms-2 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-600 hover:underline"
        >
          המשך לפתח
          <Icon name="arrow-end" size={14} />
        </button>
        <button
          onClick={onRemove}
          disabled={removing}
          className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50 px-2 py-1 -me-2"
        >
          {removing ? "מוחק..." : "מחק"}
        </button>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <Card className="p-8 text-center text-neutral-600 max-w-lg mx-auto">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-400">
        <Icon name="idea" size={24} />
      </div>
      <h2 className="text-base font-semibold mb-2 text-neutral-900">
        שלום — אני שותף החשיבה שלך
      </h2>
      <p className="text-sm mb-3">
        זרוק לי כל רעיון, מחשבה או התחלה של רעיון — גם אם זה רק כמה מילים. אשמור
        אותו, אנסח אותו טוב שנזכור, ואעזור לפתח אותו לכיוון או מהלך ראשון.
      </p>
      <p className="text-xs text-neutral-500">
        דוגמה: "יש לי הרגשה שאני מפספס לקוחות חוזרים — אולי כדאי משהו עם מועדון
        לקוחות."
      </p>
    </Card>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import { type ChatTurn, remindersApi } from "../../api/reminders";
import { type Task, tasksApi } from "../../api/tasks";
import {
  BUCKET_LABEL,
  BUCKET_ORDER,
  type ReminderBucket,
  bucketOf,
} from "../../lib/reminderBuckets";
import { Button, Card, FormError, Spinner } from "../../components/ui";

interface UIMessage extends ChatTurn {
  createdAt: number;
}

const BUCKET_TONE: Record<ReminderBucket, string> = {
  overdue: "bg-red-100 text-red-700",
  today: "bg-brand-100 text-brand-700",
  soon: "bg-amber-100 text-amber-700",
  later: "bg-neutral-100 text-neutral-600",
  none: "bg-neutral-100 text-neutral-500",
};

export default function RemindersAgent({ businessId }: { businessId: string }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  const tasks = useQuery({
    queryKey: ["tasks", businessId],
    queryFn: () => tasksApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const ent = useQuery({
    queryKey: ["reminders", "entitlement", businessId],
    queryFn: () => remindersApi.entitlement(businessId),
    enabled: Boolean(businessId),
  });
  const locked = ent.data?.locked ?? false;
  const onTrial = Boolean(ent.data?.onTrial) && !ent.data?.paid;
  const daysLeft = ent.data?.daysLeft ?? 0;

  const chat = useMutation({
    mutationFn: (history: ChatTurn[]) => remindersApi.chat(businessId, history),
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply, createdAt: Date.now() },
      ]);
      if (result.changed) void tasks.refetch();
    },
    onError: (err) => setError(apiErrorMessage(err, "אירעה שגיאה. נסה שוב.")),
  });

  const complete = useMutation({
    mutationFn: (id: string) =>
      tasksApi.update(businessId, id, { status: "done" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", businessId] }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const content = draft.trim();
    if (!content || chat.isPending) return;
    const nextHistory: ChatTurn[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user", content },
    ];
    setMessages((prev) => [
      ...prev,
      { role: "user", content, createdAt: Date.now() },
    ]);
    setDraft("");
    chat.mutate(nextHistory);
  };

  const open = (tasks.data ?? []).filter((t) => t.status !== "done");
  const byBucket = (b: ReminderBucket) =>
    open.filter((t) => bucketOf(t.dueAt) === b);

  if (locked) return <RemindersLocked businessId={businessId} />;

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col h-full min-h-0">
        <header className="px-8 py-5 border-b border-neutral-200 bg-white flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">סוכן תזכורות</h1>
            <p className="text-sm text-neutral-500">
              שלא תשכח כלום — בקש ממני להזכיר, לדחות, לסמן כבוצע, או לשאול "מה
              דחוף".
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

        {onTrial && (
          <Link
            to={`/app/businesses/${businessId}/billing`}
            className="block bg-amber-50 border-b border-amber-200 px-8 py-2.5 text-sm text-amber-800 hover:bg-amber-100 transition-colors"
          >
            ⏳ תקופת ניסיון — נותרו {daysLeft} ימים לסוכן התזכורות.{" "}
            <span className="font-semibold underline">שדרג כדי להמשיך</span>
          </Link>
        )}

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
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
              placeholder="לדוגמה: 'תזכיר לי להתקשר לדנה מחר ב-10' או 'מה יש לי היום?'"
              className="flex-1 block rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none resize-none"
            />
            <Button
              type="submit"
              disabled={!draft.trim() || chat.isPending}
              size="md"
            >
              שלח
            </Button>
          </div>
        </form>
      </div>

      <aside className="hidden lg:block border-s border-neutral-200 bg-neutral-50 overflow-y-auto p-5">
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">לטיפול</h2>
        {tasks.isLoading && (
          <div className="text-sm text-neutral-500">טוען...</div>
        )}
        {open.length === 0 && !tasks.isLoading && (
          <div className="text-sm text-neutral-500">אין מה לטפל בו כרגע. 🎉</div>
        )}
        <div className="space-y-4">
          {BUCKET_ORDER.map((bucket) => {
            const items = byBucket(bucket);
            if (items.length === 0) return null;
            return (
              <div key={bucket}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${BUCKET_TONE[bucket]}`}
                  >
                    {BUCKET_LABEL[bucket]}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {items.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {items.map((t) => (
                    <ReminderItem
                      key={t.id}
                      task={t}
                      onDone={() => complete.mutate(t.id)}
                      doing={complete.isPending && complete.variables === t.id}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function ReminderItem({
  task,
  onDone,
  doing,
}: {
  task: Task;
  onDone: () => void;
  doing: boolean;
}) {
  return (
    <li className="bg-white border border-neutral-200 rounded-lg p-2.5">
      <div className="text-xs font-medium text-neutral-800 leading-snug mb-1">
        {task.title}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-neutral-400">
          {task.dueAt
            ? new Date(task.dueAt).toLocaleString("he-IL", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "ללא תאריך"}
        </span>
        <button
          onClick={onDone}
          disabled={doing}
          className="text-[10px] font-medium text-brand-600 hover:underline disabled:opacity-50"
        >
          {doing ? "..." : "בוצע ✓"}
        </button>
      </div>
    </li>
  );
}

function Message({ message }: { message: UIMessage }) {
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
      </div>
    </div>
  );
}

function RemindersLocked({ businessId }: { businessId: string }) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <Card className="p-8 text-center max-w-md">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-lg font-bold text-navy-900 mb-2">
          תקופת הניסיון של סוכן התזכורות הסתיימה
        </h2>
        <p className="text-sm text-navy-500 mb-5">
          כדי להמשיך לקבל תזכורות חכמות שלא תפספס אף מעקב, שדרג לתוכנית בתשלום.
          המשימות הקיימות שלך נשמרות.
        </p>
        <Link
          to={`/app/businesses/${businessId}/billing`}
          className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          לצפייה בתוכניות ולשדרוג
        </Link>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="p-8 text-center text-neutral-600 max-w-lg mx-auto">
      <div className="text-2xl mb-3">⏰</div>
      <h2 className="text-base font-semibold mb-2 text-neutral-900">
        שלום — אני אדאג שלא תשכח כלום
      </h2>
      <p className="text-sm mb-3">
        בקש ממני להזכיר לך מעקבים ומשימות עם תאריך, ואני אציף לך מה באיחור, מה
        להיום ומה בקרוב. אפשר גם לסמן כבוצע, לדחות למחר/שבוע, או לשאול "מה דחוף".
      </p>
      <p className="text-xs text-neutral-500">
        דוגמה: "תזכיר לי לשלוח הצעת מחיר לאורל עד יום חמישי."
      </p>
    </Card>
  );
}

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import {
  type ChatTurn,
  type DocumentInstance,
  documentsApi,
} from "../../api/documents";
import { Button, Card, FormError, Spinner } from "../../components/ui";

interface UIMessage extends ChatTurn {
  createdAt: number;
  created?: DocumentInstance[];
}

export default function DocumentsAgent({ businessId }: { businessId: string }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const recent = useQuery({
    queryKey: ["documents", "instances", businessId],
    queryFn: () => documentsApi.listInstances(businessId),
    enabled: Boolean(businessId),
  });

  const chat = useMutation({
    mutationFn: (history: ChatTurn[]) =>
      documentsApi.chat(businessId, history),
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          createdAt: Date.now(),
          created: result.created,
        },
      ]);
      if (result.created.length > 0) {
        void recent.refetch();
      }
    },
    onError: (err) => {
      setError(apiErrorMessage(err, "אירעה שגיאה. נסה שוב."));
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
    const next: UIMessage = {
      role: "user",
      content,
      createdAt: Date.now(),
    };
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

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col h-full min-h-0">
        <header className="px-8 py-5 border-b border-neutral-200 bg-white flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">סוכן מסמכים</h1>
            <p className="text-sm text-neutral-500">
              ספר על העסקה, הסוכן יכין את המסמך ויחזיר קישור לחתימה.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onStartNew}>
            שיחה חדשה
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
          {messages.length === 0 && !chat.isPending && (
            <EmptyState />
          )}
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
              placeholder="לדוגמה: 'הלקוח שלי אורל אריאלי רוצה הדרכת AI לעסקים — 4 שעות, 3 קבוצות, 100 איש. העלות 4500 ש״ח עם מקדמה.'"
              className="flex-1 block rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none resize-none"
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
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">
          מסמכים אחרונים
        </h2>
        {recent.isLoading && (
          <div className="text-sm text-neutral-500">טוען...</div>
        )}
        {(recent.data ?? []).length === 0 && !recent.isLoading && (
          <div className="text-sm text-neutral-500">אין מסמכים עדיין.</div>
        )}
        <ul className="space-y-2">
          {(recent.data ?? []).map((doc) => (
            <DocumentSummary key={doc.id} doc={doc} />
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
            ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 text-white px-4 py-3 text-sm"
            : "max-w-[80%] rounded-2xl rounded-tl-sm bg-white border border-neutral-200 text-neutral-900 px-4 py-3 text-sm shadow-sm"
        }
      >
        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
        {message.created && message.created.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.created.map((doc) => (
              <CreatedDocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreatedDocumentCard({ doc }: { doc: DocumentInstance }) {
  const publicUrl = doc.publicToken
    ? `${window.location.origin}/sign/${doc.publicToken}`
    : null;

  const copyUrl = async () => {
    if (publicUrl) {
      await navigator.clipboard.writeText(publicUrl);
    }
  };

  return (
    <div className="rounded-lg bg-white text-neutral-900 border border-neutral-200 p-3 text-xs">
      <div className="font-semibold text-sm mb-1">מסמך חדש נוצר</div>
      {publicUrl ? (
        <>
          <div className="text-neutral-600 mb-2">קישור לחתימה:</div>
          <div className="flex gap-2 items-center">
            <input
              readOnly
              value={publicUrl}
              dir="ltr"
              className="flex-1 rounded border border-neutral-200 px-2 py-1 text-xs font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={copyUrl}
              className="rounded bg-neutral-100 hover:bg-neutral-200 px-2 py-1 font-medium"
            >
              העתק
            </button>
          </div>
        </>
      ) : (
        <a
          href={`/api/businesses/${doc.id}/documents/${doc.id}/pdf`}
          download
          className="text-brand-600 hover:underline"
        >
          הורד PDF
        </a>
      )}
    </div>
  );
}

function DocumentSummary({ doc }: { doc: DocumentInstance }) {
  const url = doc.publicToken ? `/sign/${doc.publicToken}` : null;
  const statusLabel = {
    draft: "טיוטה",
    sent: "נשלח",
    signed: "חתום",
    cancelled: "בוטל",
  }[doc.status];
  return (
    <li className="bg-white border border-neutral-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold">{statusLabel}</span>
        <span className="text-[10px] text-neutral-500">
          {new Date(doc.createdAt).toLocaleDateString("he-IL")}
        </span>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="block text-[11px] text-brand-600 hover:underline truncate"
        >
          {url}
        </a>
      )}
    </li>
  );
}

function EmptyState() {
  return (
    <Card className="p-8 text-center text-neutral-600 max-w-lg mx-auto">
      <div className="text-2xl mb-3">📝</div>
      <h2 className="text-base font-semibold mb-2 text-neutral-900">
        שלום — אני הסוכן שיכין לך מסמכים
      </h2>
      <p className="text-sm mb-3">
        כתוב לי בעברית חופשית על העסקה — שם הלקוח, מה הוא הזמין, מחיר, תאריכים.
        אני אכין הזמנת עבודה ואחזיר לך קישור לחתימה לשלוח ללקוח.
      </p>
      <p className="text-xs text-neutral-500">
        דוגמה: "הלקוח שלי דנה כהן רוצה ייעוץ של 4 פגישות, 800 ש״ח כל אחת,
        מתחילים ב־1 בינואר ומסיימים ב־1 בפברואר."
      </p>
    </Card>
  );
}

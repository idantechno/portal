import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import {
  type ChatTurn,
  type DesignKind,
  type DesignProduct,
  designerApi,
} from "../../api/designer";
import { Button, Card, FormError, Spinner } from "../../components/ui";
import { Icon } from "../../components/icons";

interface UIMessage extends ChatTurn {
  createdAt: number;
  created?: DesignProduct[];
}

const KIND_LABEL: Record<DesignKind, string> = {
  menu: "תפריט",
  poster: "כרזה",
  invitation: "הזמנה",
  pricelist: "מחירון",
  flyer: "פלייר",
  other: "מוצר",
};

export default function DesignerAgent({ businessId }: { businessId: string }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  const designs = useQuery({
    queryKey: ["designs", businessId],
    queryFn: () => designerApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const chat = useMutation({
    mutationFn: (history: ChatTurn[]) => designerApi.chat(businessId, history),
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
      if (result.created.length > 0) void designs.refetch();
    },
    onError: (err) => setError(apiErrorMessage(err, "אירעה שגיאה. נסה שוב.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => designerApi.remove(businessId, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["designs", businessId] }),
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
    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col h-full min-h-0">
        <header className="px-4 sm:px-8 py-5 border-b border-neutral-200 bg-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">סוכן מעצב גרפי</h1>
            <p className="text-sm text-neutral-500">
              ספר לי מה אתה צריך — תפריט, כרזה, מחירון או הזמנה — ואעצב לך PDF
              מוכן להדפסה.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
          >
            שיחה חדשה
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4">
          {messages.length === 0 && !chat.isPending && <EmptyState />}
          {messages.map((m, i) => (
            <Message key={i} message={m} businessId={businessId} />
          ))}
          {chat.isPending && (
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <Spinner /> הסוכן מעצב...
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
              placeholder="לדוגמה: 'תפריט לקפה שלי בצבע חום #6F4E37 — אספרסו 12, קפוצ׳ינו 15, מאפה 18.'"
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
          המוצרים שלי
        </h2>
        {designs.isLoading && (
          <div className="text-sm text-neutral-500">טוען...</div>
        )}
        {(designs.data ?? []).length === 0 && !designs.isLoading && (
          <div className="text-sm text-neutral-500">אין מוצרים עדיין.</div>
        )}
        <ul className="space-y-2">
          {(designs.data ?? []).map((d) => (
            <DesignListItem
              key={d.id}
              design={d}
              businessId={businessId}
              onRemove={() => remove.mutate(d.id)}
              removing={remove.isPending && remove.variables === d.id}
            />
          ))}
        </ul>
      </aside>
    </div>
  );
}

function KindPill({ kind }: { kind: DesignKind }) {
  return (
    <span className="inline-block rounded-full bg-coral-100 text-coral-700 px-2 py-0.5 text-[10px] font-medium">
      {KIND_LABEL[kind]}
    </span>
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
            ? "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-se-sm bg-brand-600 text-white px-4 py-3 text-sm"
            : "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-ss-sm bg-white border border-neutral-200 text-neutral-900 px-4 py-3 text-sm shadow-sm"
        }
      >
        <div className="whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
        {message.created && message.created.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.created.map((d) => (
              <CreatedDesignCard key={d.id} design={d} businessId={businessId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreatedDesignCard({
  design,
  businessId,
}: {
  design: DesignProduct;
  businessId: string;
}) {
  return (
    <div className="rounded-lg bg-white text-neutral-900 border border-neutral-200 p-3 text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon name="palette" size={15} className="text-brand-500" />
          {design.title}
        </span>
        <KindPill kind={design.kind} />
      </div>
      <a
        href={designerApi.pdfUrl(businessId, design.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-brand-600 hover:underline font-medium"
      >
        פתח / הורד PDF
      </a>
    </div>
  );
}

function DesignListItem({
  design,
  businessId,
  onRemove,
  removing,
}: {
  design: DesignProduct;
  businessId: string;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <li className="bg-white border border-neutral-200 rounded-lg p-3 hover:border-brand-300 transition-colors">
      <a
        href={designerApi.pdfUrl(businessId, design.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-semibold leading-snug group-hover:text-brand-700">
            {design.title}
          </span>
          <KindPill kind={design.kind} />
        </div>
      </a>
      <div className="flex items-center justify-between">
        <a
          href={designerApi.pdfUrl(businessId, design.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-600 hover:underline px-2 py-1 -ms-2"
        >
          פתח PDF
        </a>
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
        <Icon name="palette" size={24} />
      </div>
      <h2 className="text-base font-semibold mb-2 text-neutral-900">
        שלום — אני המעצב שלך
      </h2>
      <p className="text-sm mb-3">
        אני מכין מוצרים מעוצבים פשוטים ומוכנים להדפסה: תפריט, כרזה, מחירון, הזמנה
        או פלייר. תגיד לי מה צריך, את הטקסט ואת צבע העסק — ואחזיר לך PDF.
      </p>
      <p className="text-xs text-neutral-500">
        דוגמה: "כרזה לאירוע פתיחה ב־1 במרץ, בצבע כחול, עם הכותרת 'ברוכים הבאים'."
      </p>
    </Card>
  );
}

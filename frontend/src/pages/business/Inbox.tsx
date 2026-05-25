import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  conversationsApi,
  type Conversation,
  type ConversationStatus,
  type Message,
  type MessageRole,
} from "../../api/conversations";
import { useAuthStore } from "../../store/auth";
import { apiErrorMessage } from "../../api/client";
import { Button, Card, Spinner, Textarea } from "../../components/ui";

type Tab = "all" | "bot" | "human" | "closed";

const tabToStatus = (tab: Tab): ConversationStatus | undefined =>
  tab === "all" ? undefined : (tab as ConversationStatus);

function statusBadge(status: ConversationStatus, t: (k: string) => string) {
  const tone =
    status === "bot"
      ? "bg-brand-50 text-brand-700"
      : status === "human"
      ? "bg-green-100 text-green-800"
      : "bg-neutral-100 text-neutral-600";
  const label =
    status === "bot"
      ? t("inbox.statusBot")
      : status === "human"
      ? t("inbox.statusHuman")
      : t("inbox.statusClosed");
  return (
    <span
      className={`inline-block rounded-full text-[10px] px-2 py-0.5 font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function channelIcon(channel: Conversation["channel"]) {
  return channel === "whatsapp" ? "🟢" : channel === "instagram" ? "📷" : "💬";
}

function timeShort(iso: string | null, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(lang === "he" ? "he-IL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function roleClass(role: MessageRole): string {
  switch (role) {
    case "customer":
      return "self-start bg-white border border-neutral-200";
    case "bot":
      return "self-end bg-brand-600 text-white";
    case "agent":
      return "self-end bg-green-600 text-white";
    case "system":
      return "self-center bg-amber-50 border border-amber-200 text-amber-900 text-xs";
    case "tool":
      return "self-center bg-neutral-100 border border-neutral-200 text-neutral-600 text-xs font-mono";
  }
}

export default function Inbox() {
  const { t, i18n } = useTranslation();
  const { businessId = "" } = useParams<{ businessId: string }>();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [socketReady, setSocketReady] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const conversations = useQuery({
    queryKey: ["conversations", businessId, tab],
    queryFn: () =>
      conversationsApi.list(businessId, { status: tabToStatus(tab) }),
    enabled: Boolean(businessId),
    refetchInterval: socketReady ? false : 15_000,
  });

  const messages = useQuery({
    queryKey: ["messages", businessId, selectedId],
    queryFn: () => conversationsApi.messages(businessId, selectedId!),
    enabled: Boolean(businessId && selectedId),
  });

  const selected = useMemo(
    () => conversations.data?.find((c) => c.id === selectedId) ?? null,
    [conversations.data, selectedId],
  );

  const send = useMutation({
    mutationFn: (content: string) =>
      conversationsApi.sendReply(businessId, selectedId!, content),
    onSuccess: () => {
      setComposer("");
      qc.invalidateQueries({ queryKey: ["messages", businessId, selectedId] });
      qc.invalidateQueries({ queryKey: ["conversations", businessId] });
    },
    onError: (err) => setError(apiErrorMessage(err, "Send failed")),
  });

  const returnToBot = useMutation({
    mutationFn: () => conversationsApi.returnToBot(businessId, selectedId!),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["conversations", businessId] }),
  });

  const closeMut = useMutation({
    mutationFn: () => conversationsApi.close(businessId, selectedId!),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["conversations", businessId] }),
  });

  const onIncomingMessage = useCallback(
    (msg: Message) => {
      qc.setQueryData<Message[] | undefined>(
        ["messages", businessId, msg.conversationId],
        (prev) => {
          if (!prev) return prev;
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        },
      );
      qc.invalidateQueries({ queryKey: ["conversations", businessId] });
    },
    [qc, businessId],
  );

  const onConversationChange = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["conversations", businessId] });
  }, [qc, businessId]);

  // Socket connection lifecycle.
  useEffect(() => {
    if (!token || !businessId) return;
    const socket = io("/inbox", {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketReady(true);
      socket.emit("join:business", { businessId });
    });
    socket.on("disconnect", () => setSocketReady(false));
    socket.on("connect_error", () => setSocketReady(false));
    socket.on("message.created", onIncomingMessage);
    socket.on("conversation.created", onConversationChange);
    socket.on("conversation.updated", onConversationChange);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, businessId, onIncomingMessage, onConversationChange]);

  // Auto-scroll thread to bottom on new messages.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  function submitReply(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!composer.trim() || !selectedId) return;
    send.mutate(composer.trim());
  }

  const list = conversations.data ?? [];
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "all", label: t("inbox.tabAll") },
    { key: "bot", label: t("inbox.tabBot") },
    { key: "human", label: t("inbox.tabHuman") },
    { key: "closed", label: t("inbox.tabClosed") },
  ];

  return (
    <div className="grid grid-cols-[360px_1fr] h-full">
      {/* Conversation list */}
      <div className="border-e border-neutral-200 bg-white flex flex-col min-h-0">
        <header className="px-5 py-4 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold">{t("inbox.title")}</h1>
            <span
              className={`inline-flex items-center gap-1 text-[11px] ${
                socketReady ? "text-green-700" : "text-neutral-400"
              }`}
              title={socketReady ? t("inbox.live") : t("inbox.offline")}
            >
              <span
                className={`inline-block size-2 rounded-full ${
                  socketReady ? "bg-green-500" : "bg-neutral-300"
                }`}
              />
              {socketReady ? t("inbox.live") : t("inbox.offline")}
            </span>
          </div>
          <div className="flex gap-1">
            {tabs.map((tt) => (
              <button
                key={tt.key}
                onClick={() => setTab(tt.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  tab === tt.key
                    ? "bg-brand-100 text-brand-700"
                    : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {tt.label}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto min-h-0">
          {conversations.isLoading && (
            <div className="p-4 text-sm text-neutral-500">
              {t("common.loading")}
            </div>
          )}
          {list.length === 0 && !conversations.isLoading && (
            <div className="p-8 text-sm text-neutral-500 text-center">
              {t("inbox.empty")}
            </div>
          )}
          <ul className="divide-y divide-neutral-100">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-start px-5 py-3 hover:bg-neutral-50 ${
                    selectedId === c.id ? "bg-brand-50/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{channelIcon(c.channel)}</span>
                    <span className="font-medium text-sm truncate" dir="ltr">
                      {c.externalThreadId}
                    </span>
                    <span className="ms-auto">
                      {statusBadge(c.status, t)}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {timeShort(c.lastMessageAt ?? c.createdAt, i18n.language)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Thread + composer */}
      <div className="flex flex-col min-h-0 bg-neutral-50">
        {!selected && (
          <div className="flex-1 grid place-items-center text-neutral-400 text-sm">
            {t("inbox.selectConversation")}
          </div>
        )}
        {selected && (
          <>
            <header className="border-b border-neutral-200 bg-white px-6 py-4 flex items-center gap-3">
              <span className="text-xl">{channelIcon(selected.channel)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate" dir="ltr">
                  {selected.externalThreadId}
                </div>
                <div className="text-xs text-neutral-500">
                  {timeShort(selected.lastMessageAt, i18n.language)}
                </div>
              </div>
              {statusBadge(selected.status, t)}
              {selected.status === "human" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => returnToBot.mutate()}
                  disabled={returnToBot.isPending}
                >
                  {t("inbox.returnToBot")}
                </Button>
              )}
              {selected.status !== "closed" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => closeMut.mutate()}
                  disabled={closeMut.isPending}
                >
                  {t("inbox.close")}
                </Button>
              )}
            </header>

            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
              <div className="flex flex-col gap-2 max-w-3xl mx-auto">
                {messages.isLoading && (
                  <div className="text-sm text-neutral-500">
                    {t("common.loading")}
                  </div>
                )}
                {messages.data?.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${roleClass(
                      m.role,
                    )}`}
                  >
                    {m.content}
                    <div className="text-[10px] opacity-70 mt-1">
                      {timeShort(m.createdAt, i18n.language)}
                    </div>
                  </div>
                ))}
                <div ref={threadEndRef} />
              </div>
            </div>

            {selected.status !== "closed" && (
              <form
                onSubmit={submitReply}
                className="border-t border-neutral-200 bg-white px-6 py-3"
              >
                {error && (
                  <div className="text-xs text-red-700 mb-2">{error}</div>
                )}
                <div className="flex items-end gap-3 max-w-3xl mx-auto">
                  <Textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder={t("inbox.composerPlaceholder")}
                    rows={2}
                    className="flex-1 min-h-16"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        submitReply(e as unknown as FormEvent);
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    disabled={send.isPending || !composer.trim() || !user}
                  >
                    {send.isPending ? (
                      <>
                        <Spinner /> {t("inbox.sending")}
                      </>
                    ) : (
                      t("inbox.send")
                    )}
                  </Button>
                </div>
                <div className="text-[11px] text-neutral-400 mt-1 text-center max-w-3xl mx-auto">
                  ⌘/Ctrl + Enter
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

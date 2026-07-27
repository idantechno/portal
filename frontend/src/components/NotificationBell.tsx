import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../api/notifications";
import { EmptyState } from "./ui";
import type { AppNotification, NotificationType } from "../api/notifications";
import { Icon } from "./icons";
import type { IconName } from "./icons";
import {
  enablePush,
  hasPushSubscription,
  isPushSupported,
  pushPermission,
} from "../pwa/push";

/** Each notification type gets the same glyph the matching screen uses in the
 *  sidebar, so a notification visually points at where it lands. */
const ICON: Record<NotificationType, IconName> = {
  lead: "leads",
  message: "chat",
  task: "tasks",
  document: "doc",
  billing: "receipt",
  automation: "bolt",
  system: "bell",
};

export function NotificationBell({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const unread = useQuery({
    queryKey: ["notif-count", businessId],
    queryFn: () => notificationsApi.unreadCount(businessId),
    enabled: Boolean(businessId),
    refetchInterval: 30000,
  });
  const list = useQuery({
    queryKey: ["notifications", businessId],
    queryFn: () => notificationsApi.list(businessId),
    enabled: Boolean(businessId) && open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notif-count", businessId] });
    qc.invalidateQueries({ queryKey: ["notifications", businessId] });
  };

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(businessId),
    onSuccess: invalidate,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(businessId, id),
    onSuccess: invalidate,
  });

  // Clicking a notification marks it read, closes the panel, and jumps to the
  // relevant screen (each notification carries a `link`, e.g. /app/.../leads).
  const onItemClick = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const count = unread.data ?? 0;
  const items = list.data ?? [];

  // Push opt-in state: "on" already subscribed, "off" can enable, "denied"
  // blocked in browser settings, "unsupported"/null hide the row entirely.
  const [pushState, setPushState] = useState<
    "on" | "off" | "denied" | "unsupported" | null
  >(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      // Awaited up front so state updates never land synchronously in-effect.
      await Promise.resolve();
      if (cancelled) return;
      if (!isPushSupported()) return setPushState("unsupported");
      if (pushPermission() === "denied") return setPushState("denied");
      const has = await hasPushSubscription();
      if (!cancelled) setPushState(has ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const onEnablePush = async () => {
    setPushBusy(true);
    try {
      const result = await enablePush(businessId);
      setPushState(
        result === "subscribed"
          ? "on"
          : result === "denied"
            ? "denied"
            : "unsupported",
      );
    } finally {
      setPushBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-navy-600 transition-colors hover:bg-cream-50 hover:text-navy-800"
        aria-label="התראות"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="bell" size={19} />
        {count > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full bg-coral-500 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="התראות"
            className="absolute end-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-auto z-40 rounded-2xl border border-navy-100 bg-white shadow-[0_24px_48px_-24px_rgba(1,20,39,0.4)]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-navy-100 sticky top-0 bg-white">
              <span className="font-semibold text-navy-900 text-sm">
                התראות
              </span>
              {count > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="text-xs text-brand-600 hover:text-brand-700"
                >
                  סמן הכל כנקרא
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <EmptyState icon="bell" title="אין התראות" />
            ) : (
              <ul role="menu" className="divide-y divide-navy-50">
                {items.map((n) => (
                  <li key={n.id} role="none">
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => onItemClick(n)}
                      className={`w-full text-start px-4 py-3 flex items-start gap-3 transition-colors hover:bg-cream-50 ${
                        n.read ? "opacity-60" : "bg-brand-50/40"
                      } ${n.link ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                        <Icon name={ICON[n.type]} size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-navy-900">
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="text-xs text-navy-400 truncate">
                            {n.body}
                          </div>
                        )}
                      </div>
                      {n.link && (
                        <Icon
                          name="chevron-start"
                          size={16}
                          className="self-center shrink-0 text-navy-300 rtl:-scale-x-100"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pushState && pushState !== "unsupported" && (
              <div className="sticky bottom-0 border-t border-navy-100 bg-white px-4 py-2.5">
                {pushState === "on" ? (
                  <div className="flex items-center gap-2 text-xs text-navy-400">
                    <Icon name="bell" size={14} />
                    התראות בטלפון פעילות
                  </div>
                ) : pushState === "denied" ? (
                  <div className="text-xs text-navy-400">
                    התראות חסומות בהגדרות הדפדפן. אפשר לפתוח אותן שם.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onEnablePush}
                    disabled={pushBusy}
                    className="flex items-center gap-2 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                  >
                    <Icon name="bell" size={14} />
                    {pushBusy ? "מפעיל…" : "הפעל התראות בטלפון"}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

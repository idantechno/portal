import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../api/notifications";
import type { NotificationType } from "../api/notifications";

const ICON: Record<NotificationType, string> = {
  lead: "🤝",
  message: "💬",
  task: "✅",
  document: "📝",
  billing: "🧾",
  automation: "⚡",
  system: "🔔",
};

export function NotificationBell({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

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

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(businessId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count", businessId] });
      qc.invalidateQueries({ queryKey: ["notifications", businessId] });
    },
  });

  const count = unread.data ?? 0;
  const items = list.data ?? [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-xl hover:bg-cream-50 flex items-center justify-center text-navy-600"
        aria-label="התראות"
      >
        <span className="text-lg">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full bg-coral-500 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-2 w-80 max-h-96 overflow-auto z-40 rounded-2xl border border-navy-100 bg-white shadow-[0_24px_48px_-24px_rgba(1,20,39,0.4)]">
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
              <div className="px-4 py-10 text-center text-navy-400 text-sm">
                אין התראות
              </div>
            ) : (
              <ul className="divide-y divide-navy-50">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 flex gap-3 ${n.read ? "opacity-60" : "bg-brand-50/40"}`}
                  >
                    <span className="text-base shrink-0">{ICON[n.type]}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-navy-900">
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-xs text-navy-400 truncate">
                          {n.body}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { scheduleApi } from "../../../api/schedule";
import type { AgendaItem, AgendaSource } from "../../../api/schedule";
import { Card, Spinner } from "../../../components/ui";
import { Icon, type IconName } from "../../../components/icons";

const SRC: Record<
  AgendaSource,
  { label: string; icon: IconName; cls: string; busy: boolean }
> = {
  appointment: { label: "פגישה", icon: "clock", cls: "text-coral-600", busy: true },
  task: { label: "משימה", icon: "tasks", cls: "text-brand-600", busy: true },
  calendar: { label: "Google", icon: "calendar", cls: "text-teal-600", busy: true },
  reminder: { label: "תזכורת", icon: "bell", cls: "text-amber-600", busy: false },
};

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DayAgendaSection({
  businessId,
}: {
  businessId: string;
}) {
  // Today's window in the browser's local (Israel) time.
  const { fromISO, toISO, dayKey } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      fromISO: start.toISOString(),
      toISO: end.toISOString(),
      dayKey: start.toISOString().slice(0, 10),
    };
  }, []);

  const agenda = useQuery({
    queryKey: ["schedule", "agenda", businessId, dayKey],
    queryFn: () => scheduleApi.agenda(businessId, fromISO, toISO),
    enabled: Boolean(businessId),
  });

  if (agenda.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const items = agenda.data?.items ?? [];
  const conflicts = agenda.data?.conflicts ?? [];
  const counts = items.reduce<Record<AgendaSource, number>>(
    (acc, it) => {
      acc[it.source] = (acc[it.source] ?? 0) + 1;
      return acc;
    },
    { appointment: 0, task: 0, calendar: 0, reminder: 0 },
  );
  const busyCount =
    counts.appointment + counts.task + counts.calendar;

  const today = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      {/* Summary */}
      <Card className="mb-4 p-4">
        <div className="mb-1 text-sm text-navy-400">{today}</div>
        {items.length === 0 ? (
          <div className="text-sm text-navy-500">
            הלו"ז שלך פנוי היום. 🎉
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-700">
            {counts.appointment > 0 && <span>{counts.appointment} פגישות</span>}
            {counts.task > 0 && <span>{counts.task} משימות</span>}
            {counts.calendar > 0 && <span>{counts.calendar} ביומן</span>}
            {counts.reminder > 0 && <span>{counts.reminder} תזכורות</span>}
            {busyCount >= 6 && (
              <span className="rounded-full bg-coral-50 px-2 py-0.5 text-xs font-medium text-coral-600">
                יום עמוס
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Card className="mb-4 border border-coral-200 bg-coral-50/50 p-4">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-coral-700">
            <Icon name="warning" size={16} />
            חפיפות בלו"ז
          </div>
          <ul className="space-y-1 text-xs text-coral-700/90">
            {conflicts.map((c, i) => (
              <li key={i}>
                {c.a} ↔ {c.b}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Timeline */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it, i) => (
            <AgendaRow key={i} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const meta = SRC[item.source];
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <div className="w-14 shrink-0 text-sm font-medium text-navy-900 tabular-nums">
        {hhmm(item.start)}
      </div>
      <div className={`shrink-0 ${meta.cls}`}>
        <Icon name={meta.icon} size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-navy-900">{item.title}</div>
      </div>
      <span className="shrink-0 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] text-navy-400">
        {meta.label}
      </span>
    </Card>
  );
}

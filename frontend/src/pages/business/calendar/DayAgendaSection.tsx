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

/** A day with this many busy blocks (or more) is flagged as heavy. */
const HEAVY_DAY = 6;

export type Range = "today" | "week";

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Local YYYY-MM-DD (not UTC) so items land in the right day bucket. */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function busyOf(items: AgendaItem[]): number {
  return items.filter((it) => SRC[it.source].busy).length;
}

export default function DayAgendaSection({
  businessId,
  range,
}: {
  businessId: string;
  range: Range;
}) {
  // The active window in the browser's local (Israel) time — today, or the next
  // 7 days. The agenda endpoint takes any [from, to) range.
  const { fromISO, toISO, rangeKey, startMs } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + (range === "week" ? 7 : 1));
    return {
      fromISO: start.toISOString(),
      toISO: end.toISOString(),
      rangeKey: `${range}:${localDayKey(start)}`,
      startMs: start.getTime(),
    };
  }, [range]);

  const agenda = useQuery({
    queryKey: ["schedule", "agenda", businessId, rangeKey],
    queryFn: () => scheduleApi.agenda(businessId, fromISO, toISO),
    enabled: Boolean(businessId),
  });

  const items = agenda.data?.items ?? [];
  const conflicts = agenda.data?.conflicts ?? [];

  return (
    <div>
      {agenda.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : range === "today" ? (
        <TodayView items={items} conflicts={conflicts} />
      ) : (
        <WeekView items={items} conflicts={conflicts} startMs={startMs} />
      )}
    </div>
  );
}

function ConflictsCard({
  conflicts,
}: {
  conflicts: { a: string; b: string }[];
}) {
  if (conflicts.length === 0) return null;
  return (
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
  );
}

function TodayView({
  items,
  conflicts,
}: {
  items: AgendaItem[];
  conflicts: { a: string; b: string }[];
}) {
  const counts = items.reduce<Record<AgendaSource, number>>(
    (acc, it) => {
      acc[it.source] = (acc[it.source] ?? 0) + 1;
      return acc;
    },
    { appointment: 0, task: 0, calendar: 0, reminder: 0 },
  );
  const busyCount = counts.appointment + counts.task + counts.calendar;
  const today = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <Card className="mb-4 p-4">
        <div className="mb-1 text-sm text-navy-400">{today}</div>
        {items.length === 0 ? (
          <div className="text-sm text-navy-500">הלו"ז שלך פנוי היום. 🎉</div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-700">
            {counts.appointment > 0 && <span>{counts.appointment} פגישות</span>}
            {counts.task > 0 && <span>{counts.task} משימות</span>}
            {counts.calendar > 0 && <span>{counts.calendar} ביומן</span>}
            {counts.reminder > 0 && <span>{counts.reminder} תזכורות</span>}
            {busyCount >= HEAVY_DAY && (
              <span className="rounded-full bg-coral-50 px-2 py-0.5 text-xs font-medium text-coral-600">
                יום עמוס
              </span>
            )}
          </div>
        )}
      </Card>

      <ConflictsCard conflicts={conflicts} />

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

function WeekView({
  items,
  conflicts,
  startMs,
}: {
  items: AgendaItem[];
  conflicts: { a: string; b: string }[];
  startMs: number;
}) {
  // Seven day buckets from the range start, each with its items in order.
  const days = useMemo(() => {
    const buckets: { key: string; date: Date; items: AgendaItem[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startMs);
      d.setDate(d.getDate() + i);
      buckets.push({ key: localDayKey(d), date: d, items: [] });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const it of items) {
      byKey.get(localDayKey(new Date(it.start)))?.items.push(it);
    }
    return buckets;
  }, [items, startMs]);

  // Smarter load insights: the heaviest day and how many days are free.
  const insight = useMemo(() => {
    let heaviest: { date: Date; busy: number } | null = null;
    let freeDays = 0;
    for (const d of days) {
      const busy = busyOf(d.items);
      if (busy === 0) freeDays++;
      if (!heaviest || busy > heaviest.busy)
        heaviest = { date: d.date, busy };
    }
    return { heaviest, freeDays };
  }, [days]);

  const dayLabel = (d: Date) =>
    d.toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <div>
      {/* Week insight strip */}
      <Card className="mb-4 p-4">
        <div className="mb-1 text-sm text-navy-400">7 הימים הקרובים</div>
        {items.length === 0 ? (
          <div className="text-sm text-navy-500">
            שבוע פנוי לגמרי לפניך. 🎉
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-700">
            {insight.heaviest && insight.heaviest.busy > 0 && (
              <span>
                היום העמוס:{" "}
                <strong>
                  {insight.heaviest.date.toLocaleDateString("he-IL", {
                    weekday: "long",
                  })}
                </strong>{" "}
                ({insight.heaviest.busy})
                {insight.heaviest.busy >= HEAVY_DAY && (
                  <span className="ms-2 rounded-full bg-coral-50 px-2 py-0.5 text-xs font-medium text-coral-600">
                    עמוס
                  </span>
                )}
              </span>
            )}
            {insight.freeDays > 0 && (
              <span className="text-navy-500">
                {insight.freeDays} ימים פנויים
              </span>
            )}
          </div>
        )}
      </Card>

      <ConflictsCard conflicts={conflicts} />

      {/* Day-by-day */}
      <div className="space-y-5">
        {days.map((d) => {
          const busy = busyOf(d.items);
          return (
            <div key={d.key}>
              <div className="mb-2 flex items-center gap-2">
                <div className="text-sm font-medium text-navy-700">
                  {dayLabel(d.date)}
                </div>
                {busy >= HEAVY_DAY && (
                  <span className="rounded-full bg-coral-50 px-2 py-0.5 text-[11px] font-medium text-coral-600">
                    יום עמוס
                  </span>
                )}
              </div>
              {d.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-navy-100 px-3.5 py-2.5 text-xs text-navy-400">
                  פנוי
                </div>
              ) : (
                <div className="space-y-2">
                  {d.items.map((it, i) => (
                    <AgendaRow key={i} item={it} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
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

import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { calendarApi } from "../../api/calendar";
import { Button, Card, FormError, Spinner } from "../../components/ui";
import { Icon } from "../../components/icons";

type ItemKind = "reminder" | "google";
interface CalItem {
  id: string;
  title: string;
  date: Date;
  kind: ItemKind;
  taskId?: string;
}

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export default function Calendar() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 6-week grid starting on the Sunday on/before the 1st of the month.
  const gridStart = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    return new Date(
      first.getFullYear(),
      first.getMonth(),
      1 - first.getDay(),
    );
  }, [cursor]);
  const days = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
      }),
    [gridStart],
  );
  const rangeTo = useMemo(() => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + 42);
    return d;
  }, [gridStart]);

  const status = useQuery({
    queryKey: ["calendar", "status", businessId],
    queryFn: () => calendarApi.status(businessId),
    enabled: Boolean(businessId),
  });
  const connected = status.data?.connected ?? false;

  const tasks = useQuery({
    queryKey: ["tasks", businessId],
    queryFn: () => tasksApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const google = useQuery({
    queryKey: ["calendar", "google", businessId, gridStart.toISOString()],
    queryFn: () =>
      calendarApi.googleEvents(
        businessId,
        gridStart.toISOString(),
        rangeTo.toISOString(),
      ),
    enabled: Boolean(businessId) && connected,
  });

  const items: CalItem[] = useMemo(() => {
    const out: CalItem[] = [];
    for (const t of tasks.data ?? []) {
      if (t.dueAt && t.status !== "done") {
        out.push({
          id: `t-${t.id}`,
          title: t.title,
          date: new Date(t.dueAt),
          kind: "reminder",
          taskId: t.id,
        });
      }
    }
    for (const e of google.data ?? []) {
      out.push({
        id: `g-${e.id}`,
        title: e.title,
        date: new Date(e.start),
        kind: "google",
      });
    }
    return out;
  }, [tasks.data, google.data]);

  const itemsOn = (d: Date) =>
    items
      .filter((it) => sameDay(it.date, d))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tasks", businessId] });
    void qc.invalidateQueries({ queryKey: ["calendar", "google", businessId] });
  };

  const create = useMutation({
    mutationFn: async (body: { title: string; startISO: string }) => {
      if (connected) {
        await calendarApi.createEvent(businessId, {
          title: body.title,
          start: body.startISO,
        });
      } else {
        await tasksApi.create(businessId, {
          title: body.title,
          dueAt: body.startISO,
        });
      }
    },
    onSuccess: () => {
      setTitle("");
      setWhen("");
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, "ההוספה נכשלה")),
  });
  const complete = useMutation({
    mutationFn: (id: string) =>
      tasksApi.update(businessId, id, { status: "done" }),
    onSuccess: invalidate,
  });

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !when) return;
    create.mutate({
      title: title.trim(),
      startISO: new Date(when).toISOString(),
    });
  };

  const today = new Date();
  const selectedItems = itemsOn(selected);

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-navy-900">יומן</h1>
          <p className="text-navy-500 text-sm">
            {connected
              ? "מסונכרן עם Google Calendar — כולל תזכורות מהמערכת."
              : "כולל תזכורות מהמערכת. חבר את Google Calendar באינטגרציות לסנכרון מלא."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-navy-200 text-navy-600 transition-colors hover:bg-cream-50"
            aria-label="חודש קודם"
          >
            <Icon name="chevron-start" size={17} />
          </button>
          <div className="text-sm font-semibold text-navy-800 w-28 text-center">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <button
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-navy-200 text-navy-600 transition-colors hover:bg-cream-50"
            aria-label="חודש הבא"
          >
            <Icon name="chevron-end" size={17} />
          </button>
        </div>
      </header>

      <Card className="p-3 mb-4">
        <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="אירוע חדש..."
            className="flex-1 w-full sm:w-auto sm:min-w-[160px] rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full sm:w-auto min-w-0 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!title.trim() || !when || create.isPending}
          >
            {create.isPending ? <Spinner /> : connected ? "הוסף ל-Google" : "הוסף"}
          </Button>
        </form>
        <FormError message={error} />
      </Card>

      <Card className="overflow-hidden mb-6">
        <div className="grid grid-cols-7 bg-cream-50 border-b border-navy-100">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-xs font-semibold text-navy-400 py-2"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const dayItems = itemsOn(d);
            const isToday = sameDay(d, today);
            const isSel = sameDay(d, selected);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(new Date(d))}
                className={`min-w-0 min-h-[60px] sm:min-h-[76px] border-b border-e border-navy-50 p-1 sm:p-1.5 text-start align-top transition-colors ${
                  inMonth ? "bg-white" : "bg-neutral-50/60"
                } ${isSel ? "ring-2 ring-brand-300 ring-inset" : "hover:bg-cream-50"}`}
              >
                <div
                  className={`text-xs mb-1 inline-flex items-center justify-center h-5 w-5 rounded-full ${
                    isToday
                      ? "bg-brand-600 text-white font-bold"
                      : inMonth
                        ? "text-navy-700"
                        : "text-navy-300"
                  }`}
                >
                  {d.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayItems.slice(0, 3).map((it) => (
                    <div
                      key={it.id}
                      className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                        it.kind === "google"
                          ? "bg-teal-100 text-teal-800"
                          : "bg-brand-100 text-brand-800"
                      }`}
                    >
                      {it.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <div className="text-[10px] text-navy-400 px-1">
                      +{dayItems.length - 3}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-navy-700 mb-2">
          {selected.toLocaleDateString("he-IL", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h2>
        {google.isFetching && (
          <div className="text-xs text-navy-400 mb-2">טוען אירועים מגוגל...</div>
        )}
        {selectedItems.length === 0 ? (
          <Card className="p-6 text-center text-sm text-navy-400">
            אין אירועים ביום זה.
          </Card>
        ) : (
          <Card className="divide-y divide-navy-50 overflow-hidden">
            {selectedItems.map((it) => (
              <div key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    it.kind === "google" ? "bg-teal-500" : "bg-brand-500"
                  }`}
                />
                <div className="text-xs text-navy-400 tabular-nums w-12" dir="ltr">
                  {it.date.toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="flex-1 min-w-0 text-sm text-navy-800 truncate">
                  {it.title}
                </div>
                <span className="text-[10px] text-navy-400 shrink-0">
                  {it.kind === "google" ? "Google" : "תזכורת"}
                </span>
                {it.taskId && (
                  <button
                    onClick={() => complete.mutate(it.taskId as string)}
                    className="text-[11px] font-medium text-brand-600 hover:underline"
                  >
                    בוצע ✓
                  </button>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

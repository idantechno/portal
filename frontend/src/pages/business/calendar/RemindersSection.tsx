import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../../../api/tasks";
import type { Task } from "../../../api/tasks";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Spinner,
} from "../../../components/ui";
import { Icon } from "../../../components/icons";

/** The fire time of a reminder — remindAt when set, else dueAt. */
function fireAt(t: Task): Date | null {
  const iso = t.remindAt ?? t.dueAt;
  return iso ? new Date(iso) : null;
}

function formatWhen(d: Date): string {
  return d.toLocaleString("he-IL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Where the reminder came from — a short badge label, or null for plain. */
function originLabel(t: Task): string | null {
  if (t.relatedType === "appointment") return "פגישה";
  if (t.source === "agent") return "סוכן";
  if (t.source === "automation") return "אוטומציה";
  return null;
}

type Bucket = { key: string; label: string; items: Task[] };

/** Groups active reminders by their fire time into overdue/today/week/later. */
function bucketize(reminders: Task[]): Bucket[] {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

  const buckets: Bucket[] = [
    { key: "overdue", label: "עבר המועד", items: [] },
    { key: "today", label: "היום", items: [] },
    { key: "week", label: "השבוע", items: [] },
    { key: "later", label: "בהמשך", items: [] },
    { key: "undated", label: "ללא מועד", items: [] },
  ];
  const by = Object.fromEntries(buckets.map((b) => [b.key, b])) as Record<
    string,
    Bucket
  >;

  for (const t of reminders) {
    const at = fireAt(t);
    if (!at) by.undated.items.push(t);
    else if (at < now) by.overdue.items.push(t);
    else if (at <= endOfToday) by.today.items.push(t);
    else if (at <= weekAhead) by.week.items.push(t);
    else by.later.items.push(t);
  }
  // Soonest first inside each bucket.
  for (const b of buckets) {
    b.items.sort(
      (a, c) => (fireAt(a)?.getTime() ?? 0) - (fireAt(c)?.getTime() ?? 0),
    );
  }
  return buckets.filter((b) => b.items.length > 0);
}

export default function RemindersSection({
  businessId,
}: {
  businessId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [whenLocal, setWhenLocal] = useState("");

  const reminders = useQuery({
    queryKey: ["tasks", businessId, "reminders"],
    queryFn: () => tasksApi.list(businessId, { reminders: true }),
    enabled: Boolean(businessId),
  });

  // Prefix-invalidate so the משימות tab and month grid stay in sync — a
  // reminder can be a to-do's reminder.
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["tasks", businessId] });

  const createMut = useMutation({
    mutationFn: () =>
      tasksApi.create(businessId, {
        title,
        kind: "reminder",
        remindEnabled: true,
        dueAt: whenLocal ? new Date(whenLocal).toISOString() : undefined,
      }),
    onSuccess: () => {
      setTitle("");
      setWhenLocal("");
      invalidate();
    },
  });
  const completeMut = useMutation({
    mutationFn: (id: string) =>
      tasksApi.update(businessId, id, { status: "done" }),
    onSuccess: invalidate,
  });
  const snoozeMut = useMutation({
    mutationFn: (t: Task) => {
      const base = fireAt(t) ?? new Date();
      const next = new Date(base.getTime() + 86_400_000); // +1 day
      return tasksApi.update(businessId, t.id, {
        remindAt: next.toISOString(),
      });
    },
    onSuccess: invalidate,
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => tasksApi.remove(businessId, id),
    onSuccess: invalidate,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim() && whenLocal) createMut.mutate();
  }

  const active = (reminders.data ?? []).filter((t) => t.status !== "done");
  const buckets = bucketize(active);

  return (
    <div>
      <p className="mb-4 text-sm text-navy-500">
        כל התזכורות במקום אחד — תזכורות שהפעלת על משימות, ותזכורות עצמאיות
        (כולל כאלה שהסוכנים יצרו). מקבלים נדנוד בזמן, בפעמון ובוואטסאפ.
      </p>

      <Card className="p-4 mb-6">
        <form onSubmit={submit} className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="תזכיר לי ל..."
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex flex-1 items-center gap-2 text-sm text-navy-500">
              <span className="shrink-0">מתי:</span>
              <Input
                type="datetime-local"
                value={whenLocal}
                onChange={(e) => setWhenLocal(e.target.value)}
                dir="ltr"
                className="flex-1"
              />
            </label>
            <Button
              type="submit"
              icon="bell"
              disabled={createMut.isPending || !title.trim() || !whenLocal}
              className="sm:ms-auto"
            >
              {createMut.isPending ? <Spinner /> : "צור תזכורת"}
            </Button>
          </div>
        </form>
      </Card>

      {reminders.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {!reminders.isLoading && active.length === 0 && (
        <Card>
          <EmptyState
            icon="bell"
            title="אין תזכורות פעילות"
            text="צור תזכורת, או הפעל תזכורת על משימה קיימת. גם הסוכנים יכולים ליצור תזכורות."
          />
        </Card>
      )}

      <div className="space-y-6">
        {buckets.map((b) => (
          <section key={b.key}>
            <h2
              className={`mb-2.5 text-sm font-semibold ${
                b.key === "overdue" ? "text-coral-600" : "text-navy-400"
              }`}
            >
              {b.label} ({b.items.length})
            </h2>
            <div className="space-y-2.5">
              {b.items.map((t) => (
                <ReminderRow
                  key={t.id}
                  reminder={t}
                  overdue={b.key === "overdue"}
                  onComplete={() => completeMut.mutate(t.id)}
                  onSnooze={() => snoozeMut.mutate(t)}
                  onRemove={() => removeMut.mutate(t.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ReminderRow({
  reminder,
  overdue,
  onComplete,
  onSnooze,
  onRemove,
}: {
  reminder: Task;
  overdue: boolean;
  onComplete: () => void;
  onSnooze: () => void;
  onRemove: () => void;
}) {
  const at = fireAt(reminder);
  const origin = originLabel(reminder);
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <button
        onClick={onComplete}
        aria-label="סמן כבוצע"
        className="h-5 w-5 shrink-0 rounded-md border border-navy-300 transition-colors hover:border-brand-400"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-navy-900">
          {reminder.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
          {at && (
            <span
              className={`inline-flex items-center gap-1 ${
                overdue ? "text-coral-600" : "text-navy-400"
              }`}
            >
              <Icon name="clock" size={12} />
              {formatWhen(at)}
            </span>
          )}
          {origin && (
            <span className="rounded-full bg-navy-50 px-2 py-0.5 text-navy-400">
              {origin}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onSnooze}
        className="shrink-0 rounded-lg px-2 py-1 text-xs text-navy-400 hover:bg-navy-50 hover:text-navy-700"
        title="דחה ביום"
      >
        דחה
      </button>
      <button
        onClick={onRemove}
        className="shrink-0 text-navy-300 hover:text-coral-500"
        aria-label="מחק"
      >
        <Icon name="trash" size={17} />
      </button>
    </Card>
  );
}

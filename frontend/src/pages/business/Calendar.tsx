import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import { type Task, tasksApi } from "../../api/tasks";
import {
  BUCKET_LABEL,
  BUCKET_ORDER,
  type ReminderBucket,
  bucketOf,
} from "../../lib/reminderBuckets";
import { Button, Card, FormError, Spinner } from "../../components/ui";

const BUCKET_TONE: Record<ReminderBucket, string> = {
  overdue: "bg-red-100 text-red-700",
  today: "bg-brand-100 text-brand-700",
  soon: "bg-amber-100 text-amber-700",
  later: "bg-navy-100 text-navy-600",
  none: "bg-navy-100 text-navy-500",
};

export default function Calendar() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tasks = useQuery({
    queryKey: ["tasks", businessId],
    queryFn: () => tasksApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["tasks", businessId] });

  const create = useMutation({
    mutationFn: (body: { title: string; dueAt: string }) =>
      tasksApi.create(businessId, body),
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
  const remove = useMutation({
    mutationFn: (id: string) => tasksApi.remove(businessId, id),
    onSuccess: invalidate,
  });

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !when) return;
    create.mutate({ title: title.trim(), dueAt: new Date(when).toISOString() });
  };

  // Only dated, not-done items live on the calendar timeline.
  const dated = (tasks.data ?? []).filter(
    (t) => t.dueAt && t.status !== "done",
  );
  const byBucket = (b: ReminderBucket) =>
    dated
      .filter((t) => bucketOf(t.dueAt) === b)
      .sort(
        (a, z) =>
          new Date(a.dueAt as string).getTime() -
          new Date(z.dueAt as string).getTime(),
      );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900 mb-1">יומן</h1>
        <p className="text-navy-500 text-sm">
          כל מה שמתוזמן במקום אחד — כולל תזכורות שסוכן התזכורות יוצר. הוסף אירוע
          ידני, סמן כבוצע, וראה מה מתקרב.
        </p>
      </header>

      <Card className="p-4 mb-6">
        <form onSubmit={onAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-navy-500 mb-1">אירוע</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: פגישה עם דנה"
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">מתי</label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
          </div>
          <Button
            type="submit"
            disabled={!title.trim() || !when || create.isPending}
          >
            {create.isPending ? <Spinner /> : "הוסף ליומן"}
          </Button>
        </form>
        <FormError message={error} />
      </Card>

      {tasks.isLoading && <div className="text-navy-400 text-sm">טוען...</div>}
      {!tasks.isLoading && dated.length === 0 && (
        <Card className="p-10 text-center text-navy-400">
          אין אירועים מתוזמנים. הוסף אחד למעלה או בקש מסוכן התזכורות.
        </Card>
      )}

      <div className="space-y-6">
        {BUCKET_ORDER.filter((b) => b !== "none").map((bucket) => {
          const items = byBucket(bucket);
          if (items.length === 0) return null;
          return (
            <div key={bucket}>
              <h2 className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${BUCKET_TONE[bucket]}`}
                >
                  {BUCKET_LABEL[bucket]}
                </span>
                <span className="text-xs text-navy-400">({items.length})</span>
              </h2>
              <Card className="divide-y divide-navy-50 overflow-hidden">
                {items.map((t) => (
                  <EventRow
                    key={t.id}
                    task={t}
                    onDone={() => complete.mutate(t.id)}
                    onRemove={() => remove.mutate(t.id)}
                    busy={
                      (complete.isPending && complete.variables === t.id) ||
                      (remove.isPending && remove.variables === t.id)
                    }
                  />
                ))}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventRow({
  task,
  onDone,
  onRemove,
  busy,
}: {
  task: Task;
  onDone: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const source =
    task.source === "agent"
      ? "תזכורת"
      : task.source === "automation"
        ? "אוטומציה"
        : null;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="text-sm text-navy-400 tabular-nums shrink-0 w-28" dir="ltr">
        {new Date(task.dueAt as string).toLocaleString("he-IL", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-navy-800 truncate">
          {task.title}
        </div>
        {source && <div className="text-[10px] text-navy-400">{source}</div>}
      </div>
      <button
        onClick={onDone}
        disabled={busy}
        className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
      >
        בוצע ✓
      </button>
      <button
        onClick={onRemove}
        disabled={busy}
        className="text-xs text-navy-400 hover:text-red-600 disabled:opacity-50"
      >
        מחק
      </button>
    </div>
  );
}

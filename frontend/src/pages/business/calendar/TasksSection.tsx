import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../../../api/tasks";
import type { Task, TaskPriority } from "../../../api/tasks";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Spinner,
} from "../../../components/ui";
import { Icon } from "../../../components/icons";
import type { BadgeTone } from "../../../components/ui";

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
};
const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = {
  high: "danger",
  medium: "brand",
  low: "neutral",
};
const SOURCE_LABEL: Record<Task["source"], string> = {
  manual: "ידני",
  automation: "אוטומציה",
  agent: "סוכן",
};

/** dd/mm HH:mm in Israel-locale wall-clock for a due/reminder time. */
function formatDue(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TasksSection({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueLocal, setDueLocal] = useState("");
  const [remind, setRemind] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const tasks = useQuery({
    // Only real to-dos here (kind=task); pure reminders live in the תזכורות tab.
    queryKey: ["tasks", businessId, "task"],
    queryFn: () => tasksApi.list(businessId, { kind: "task" }),
    enabled: Boolean(businessId),
  });

  // Prefix-invalidate so the תזכורות tab, month grid and home refresh too — a
  // task with a reminder shows in more than one place.
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["tasks", businessId] });

  const createMut = useMutation({
    mutationFn: () =>
      tasksApi.create(businessId, {
        title,
        priority,
        dueAt: dueLocal ? new Date(dueLocal).toISOString() : undefined,
        // A reminder needs a time to fire — only arm it when a due date is set.
        remindEnabled: remind && Boolean(dueLocal),
      }),
    onSuccess: () => {
      setTitle("");
      setPriority("medium");
      setDueLocal("");
      setRemind(false);
      invalidate();
    },
  });
  const toggleMut = useMutation({
    mutationFn: (task: Task) =>
      tasksApi.update(businessId, task.id, {
        status: task.status === "done" ? "open" : "done",
      }),
    onSuccess: invalidate,
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => tasksApi.remove(businessId, id),
    onSuccess: invalidate,
  });
  // Flip a dated task's reminder on/off (fires at its due time; the reminders
  // agent can fine-tune the exact time).
  const toggleRemindMut = useMutation({
    mutationFn: (task: Task) =>
      tasksApi.update(businessId, task.id, {
        remindEnabled: !task.remindEnabled,
      }),
    onSuccess: invalidate,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim()) createMut.mutate();
  }

  const items = tasks.data ?? [];
  const open = items.filter((t) => t.status !== "done");
  const done = items.filter((t) => t.status === "done");

  return (
    <div>
      <p className="mb-4 text-sm text-navy-500">
        המשימות הפתוחות של העסק — ידניות, מאוטומציות ומסוכנים.
      </p>

      <Card className="p-4 mb-6">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="משימה חדשה..."
              className="flex-1"
            />
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              <option value="high">עדיפות גבוהה</option>
              <option value="medium">עדיפות בינונית</option>
              <option value="low">עדיפות נמוכה</option>
            </Select>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex flex-1 items-center gap-2 text-sm text-navy-500">
              <span className="shrink-0">מועד:</span>
              <Input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                dir="ltr"
                className="flex-1"
              />
            </label>
            <label
              className={`flex items-center gap-1.5 text-sm ${
                dueLocal ? "text-navy-700" : "text-navy-300"
              }`}
              title={
                dueLocal ? "" : "כדי להפעיל תזכורת קבע קודם מועד"
              }
            >
              <input
                type="checkbox"
                checked={remind && Boolean(dueLocal)}
                disabled={!dueLocal}
                onChange={(e) => setRemind(e.target.checked)}
                className="h-4 w-4 rounded border-navy-300"
              />
              <Icon name="bell" size={15} />
              הפעל תזכורת
            </label>
            <Button
              type="submit"
              disabled={createMut.isPending}
              className="sm:ms-auto"
            >
              {createMut.isPending ? <Spinner /> : "הוסף"}
            </Button>
          </div>
        </form>
      </Card>

      {tasks.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {!tasks.isLoading && items.length === 0 && (
        <Card>
          <EmptyState
            icon="tasks"
            title="אין משימות עדיין"
            text="הוסף את המשימה הראשונה של העסק — ידנית, או תן לסוכן ליצור אותה."
            action={
              <Button icon="plus" onClick={() => titleRef.current?.focus()}>
                הוסף משימה
              </Button>
            }
          />
        </Card>
      )}

      {open.length > 0 && (
        <div className="space-y-2.5 mb-8">
          {open.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => toggleMut.mutate(task)}
              onToggleRemind={() => toggleRemindMut.mutate(task)}
              onRemove={() => removeMut.mutate(task.id)}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-navy-400 mb-3">
            הושלמו ({done.length}){" "}
            <span className="font-normal text-navy-300">
              — נמחקות אוטומטית אחרי 48 שעות
            </span>
          </h2>
          <div className="space-y-2.5 opacity-60">
            {done.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleMut.mutate(task)}
                onToggleRemind={() => toggleRemindMut.mutate(task)}
                onRemove={() => removeMut.mutate(task.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onToggleRemind,
  onRemove,
}: {
  task: Task;
  onToggle: () => void;
  onToggleRemind: () => void;
  onRemove: () => void;
}) {
  const done = task.status === "done";
  return (
    <Card className="p-3.5 flex items-center gap-3">
      <button
        onClick={onToggle}
        aria-label={done ? "סמן כפתוח" : "סמן כהושלם"}
        className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
          done
            ? "bg-teal-400 border-teal-400 text-white"
            : "border-navy-300 hover:border-brand-400"
        }`}
      >
        {done && <Icon name="check" size={13} />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-medium text-navy-900 ${done ? "line-through" : ""}`}
        >
          {task.title}
        </div>
        {task.description && (
          <div className="text-xs text-navy-400 mt-0.5">{task.description}</div>
        )}
        {task.dueAt && (
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-navy-400">
            <Icon name="clock" size={12} />
            {formatDue(task.dueAt)}
          </div>
        )}
      </div>
      <Badge tone={PRIORITY_TONE[task.priority]} className="shrink-0">
        {PRIORITY_LABEL[task.priority]}
      </Badge>
      {task.source !== "manual" && (
        <Badge tone="neutral" className="shrink-0 hidden sm:inline-flex">
          {SOURCE_LABEL[task.source]}
        </Badge>
      )}
      {task.dueAt && !done && (
        <button
          onClick={onToggleRemind}
          aria-label={task.remindEnabled ? "כבה תזכורת" : "הפעל תזכורת"}
          title={
            task.remindEnabled
              ? "תזכורת פעילה — תישלח במועד"
              : "הפעל תזכורת למועד"
          }
          className={`shrink-0 rounded-lg p-1.5 transition-colors ${
            task.remindEnabled
              ? "text-brand-600 hover:bg-brand-50"
              : "text-navy-300 hover:bg-navy-50 hover:text-navy-600"
          }`}
        >
          <Icon name="bell" size={16} />
        </button>
      )}
      <button
        onClick={onRemove}
        className="text-navy-300 hover:text-coral-500 shrink-0"
        aria-label="מחק"
      >
        <Icon name="trash" size={17} />
      </button>
    </Card>
  );
}

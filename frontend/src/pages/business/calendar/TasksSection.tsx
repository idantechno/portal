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
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
const SOURCE_LABEL: Record<Task["source"], string> = {
  manual: "ידני",
  automation: "אוטומציה",
  agent: "סוכן",
};

type SortKey = "added" | "due" | "priority";
const SORT_LABEL: Record<SortKey, string> = {
  added: "תאריך הוספה",
  due: "מועד ביצוע",
  priority: "דחיפות",
};

/** Duration choices for a dated task (minutes → Hebrew label). */
const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "15 דק׳" },
  { value: 30, label: "30 דק׳" },
  { value: 45, label: "45 דק׳" },
  { value: 60, label: "שעה" },
  { value: 90, label: "שעה וחצי" },
  { value: 120, label: "שעתיים" },
  { value: 180, label: "3 שעות" },
  { value: 240, label: "4 שעות" },
];

function durationLabel(min: number): string {
  return DURATION_OPTIONS.find((o) => o.value === min)?.label ?? `${min} דק׳`;
}

/** dd/mm HH:mm in Israel-locale wall-clock for a due/reminder time. */
function formatDue(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ISO → the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function sortTasks(list: Task[], key: SortKey): Task[] {
  const out = [...list];
  if (key === "priority") {
    out.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  } else if (key === "due") {
    // Soonest due first; tasks without a due date sink to the bottom.
    out.sort((a, b) => {
      const av = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bv = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return av - bv;
    });
  } else {
    // Newest added first.
    out.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  return out;
}

export default function TasksSection({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueLocal, setDueLocal] = useState("");
  const [duration, setDuration] = useState(30);
  const [remind, setRemind] = useState(false);
  // Optional distinct reminder time (empty → fire at the due date).
  const [remindLocal, setRemindLocal] = useState("");
  // Optional customer to also remind over WhatsApp.
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [sort, setSort] = useState<SortKey>("added");
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

  // A reminder needs a fire time: an explicit reminder time, or the due date.
  const remindFireTime = remindLocal || dueLocal;
  const createMut = useMutation({
    mutationFn: () =>
      tasksApi.create(businessId, {
        title,
        priority,
        dueAt: dueLocal ? new Date(dueLocal).toISOString() : undefined,
        // Duration only means something for a dated task (it sets the busy
        // block); skip it for an undated to-do.
        durationMinutes: dueLocal ? duration : undefined,
        remindEnabled: remind && Boolean(remindFireTime),
        // Only send a distinct reminder time when the owner set one; otherwise
        // the backend fires at the due date.
        remindAt:
          remind && remindLocal
            ? new Date(remindLocal).toISOString()
            : undefined,
        remindCustomerPhone:
          remind && custPhone.trim() ? custPhone.trim() : undefined,
        remindCustomerName:
          remind && custName.trim() ? custName.trim() : undefined,
      }),
    onSuccess: () => {
      setTitle("");
      setPriority("medium");
      setDueLocal("");
      setDuration(30);
      setRemind(false);
      setRemindLocal("");
      setCustName("");
      setCustPhone("");
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
  // Rename an existing task's title.
  const renameMut = useMutation({
    mutationFn: (v: { id: string; title: string }) =>
      tasksApi.update(businessId, v.id, { title: v.title }),
    onSuccess: invalidate,
  });
  // Set/update a reminder on an existing task (any time, even after creation).
  const setReminderMut = useMutation({
    mutationFn: (v: {
      id: string;
      remindAt: string;
      customerName: string;
      customerPhone: string;
    }) =>
      tasksApi.update(businessId, v.id, {
        remindEnabled: true,
        remindAt: v.remindAt,
        remindCustomerName: v.customerName.trim() || null,
        remindCustomerPhone: v.customerPhone.trim() || null,
      }),
    onSuccess: invalidate,
  });
  const clearReminderMut = useMutation({
    mutationFn: (id: string) =>
      tasksApi.update(businessId, id, { remindEnabled: false }),
    onSuccess: invalidate,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim()) createMut.mutate();
  }

  const items = tasks.data ?? [];
  const open = sortTasks(
    items.filter((t) => t.status !== "done"),
    sort,
  );
  const done = items.filter((t) => t.status === "done");

  return (
    <div>
      <p className="mb-4 text-sm text-navy-500">
        המשימות הפתוחות של העסק — ידניות, מאוטומציות ומסוכנים. מועד הוא רשות.
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
              <span className="shrink-0">מועד (רשות):</span>
              <Input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                dir="ltr"
                className="flex-1"
              />
            </label>
            {dueLocal && (
              <label className="flex items-center gap-2 text-sm text-navy-500">
                <span className="shrink-0">משך:</span>
                <Select
                  value={String(duration)}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-auto"
                >
                  {DURATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <label className="flex items-center gap-1.5 text-sm text-navy-700">
              <input
                type="checkbox"
                checked={remind}
                onChange={(e) => setRemind(e.target.checked)}
                className="h-4 w-4 rounded border-navy-300"
              />
              <Icon name="bell" size={15} />
              הפעל תזכורת
            </label>
          </div>

          {remind && (
            <div className="space-y-3 rounded-lg border border-navy-100 bg-cream-50/60 p-3">
              <label className="flex flex-col gap-1.5 text-sm text-navy-500 sm:flex-row sm:items-center sm:gap-2">
                <span className="shrink-0">תזכיר לי ב:</span>
                <Input
                  type="datetime-local"
                  value={remindLocal}
                  onChange={(e) => setRemindLocal(e.target.value)}
                  dir="ltr"
                  className="flex-1"
                />
                <span className="text-xs text-navy-400">
                  {remindLocal
                    ? ""
                    : dueLocal
                      ? "ריק = במועד המשימה"
                      : "קבע זמן תזכורת או מועד למשימה"}
                </span>
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="שם הלקוח לתזכורת (רשות)"
                  className="flex-1"
                />
                <Input
                  type="tel"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="טלפון הלקוח (רשות)"
                  dir="ltr"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-navy-400">
                אם תמלא טלפון לקוח — התזכורת תישלח גם אליו בוואטסאפ, לא רק אליך.
              </p>
            </div>
          )}

          {/* Submit stays the bottom-most control so it never sits above the
              reminder fields it would skip past. */}
          <div className="flex">
            <Button
              type="submit"
              disabled={createMut.isPending || (remind && !remindFireTime)}
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
        <>
          <div className="mb-3 flex items-center justify-end gap-2">
            <span className="text-xs text-navy-400">מיין לפי:</span>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-auto"
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2.5 mb-8">
            {open.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleMut.mutate(task)}
                onRename={(title) => renameMut.mutate({ id: task.id, title })}
                onSaveReminder={(v) =>
                  setReminderMut.mutate({ id: task.id, ...v })
                }
                onClearReminder={() => clearReminderMut.mutate(task.id)}
                onRemove={() => removeMut.mutate(task.id)}
              />
            ))}
          </div>
        </>
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
                onRename={(title) => renameMut.mutate({ id: task.id, title })}
                onSaveReminder={(v) =>
                  setReminderMut.mutate({ id: task.id, ...v })
                }
                onClearReminder={() => clearReminderMut.mutate(task.id)}
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
  onRename,
  onSaveReminder,
  onClearReminder,
  onRemove,
}: {
  task: Task;
  onToggle: () => void;
  onRename: (title: string) => void;
  onSaveReminder: (v: {
    remindAt: string;
    customerName: string;
    customerPhone: string;
  }) => void;
  onClearReminder: () => void;
  onRemove: () => void;
}) {
  const done = task.status === "done";
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [rCustName, setRCustName] = useState(task.remindCustomerName ?? "");
  const [rCustPhone, setRCustPhone] = useState(task.remindCustomerPhone ?? "");

  function saveTitle() {
    const next = titleDraft.trim();
    if (next && next !== task.title) onRename(next);
    setRenaming(false);
  }
  const [when, setWhen] = useState(() =>
    task.remindAt
      ? toLocalInput(task.remindAt)
      : task.dueAt
        ? toLocalInput(task.dueAt)
        : "",
  );

  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-3">
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
          {renaming ? (
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setTitleDraft(task.title);
                  setRenaming(false);
                }
              }}
              className="text-sm"
            />
          ) : (
            <div
              className={`text-sm font-medium text-navy-900 ${done ? "line-through" : ""}`}
            >
              {task.title}
            </div>
          )}
          {task.description && (
            <div className="text-xs text-navy-400 mt-0.5">
              {task.description}
            </div>
          )}
          {(task.dueAt || task.remindEnabled) && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              {task.dueAt && (
                <span className="inline-flex items-center gap-1 text-navy-400">
                  <Icon name="clock" size={12} />
                  {formatDue(task.dueAt)}
                  {task.durationMinutes ? (
                    <span className="text-navy-300">
                      · {durationLabel(task.durationMinutes)}
                    </span>
                  ) : null}
                </span>
              )}
              {task.remindEnabled && (
                <span className="inline-flex items-center gap-1 text-brand-600">
                  <Icon name="bell" size={12} />
                  {task.remindAt
                    ? formatDue(task.remindAt)
                    : task.dueAt
                      ? formatDue(task.dueAt)
                      : "תזכורת"}
                </span>
              )}
              {task.remindEnabled && task.remindCustomerPhone && (
                <span className="inline-flex items-center gap-1 text-teal-600">
                  <Icon name="user" size={12} />
                  {task.remindCustomerName?.trim() || task.remindCustomerPhone}
                </span>
              )}
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
        {!done && !renaming && (
          <button
            onClick={() => {
              setTitleDraft(task.title);
              setRenaming(true);
            }}
            aria-label="ערוך שם"
            title="ערוך שם"
            className="shrink-0 rounded-lg p-1.5 text-navy-300 transition-colors hover:bg-navy-50 hover:text-navy-600"
          >
            <Icon name="pencil" size={16} />
          </button>
        )}
        {!done && (
          <button
            onClick={() => setEditing((v) => !v)}
            aria-label="תזכורת"
            title={task.remindEnabled ? "ערוך תזכורת" : "הוסף תזכורת"}
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
      </div>

      {editing && !done && (
        <div className="mt-3 space-y-2.5 border-t border-navy-100 pt-3">
          <label className="flex flex-col gap-1.5 text-sm text-navy-500 sm:flex-row sm:items-center sm:gap-2">
            <span className="shrink-0">תזכיר לי ב:</span>
            <Input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              dir="ltr"
              className="flex-1"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={rCustName}
              onChange={(e) => setRCustName(e.target.value)}
              placeholder="שם הלקוח (רשות)"
              className="flex-1"
            />
            <Input
              type="tel"
              value={rCustPhone}
              onChange={(e) => setRCustPhone(e.target.value)}
              placeholder="טלפון הלקוח (רשות)"
              dir="ltr"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-navy-400">
            טלפון לקוח → התזכורת תישלח גם אליו בוואטסאפ.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={!when}
              onClick={() => {
                if (!when) return;
                onSaveReminder({
                  remindAt: new Date(when).toISOString(),
                  customerName: rCustName,
                  customerPhone: rCustPhone,
                });
                setEditing(false);
              }}
            >
              {task.remindEnabled ? "עדכן תזכורת" : "הפעל תזכורת"}
            </Button>
            {task.remindEnabled && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onClearReminder();
                  setEditing(false);
                }}
              >
                כבה
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

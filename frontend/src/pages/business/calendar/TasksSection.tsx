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

export default function TasksSection({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const titleRef = useRef<HTMLInputElement>(null);

  const tasks = useQuery({
    queryKey: ["tasks", businessId],
    queryFn: () => tasksApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["tasks", businessId] });

  const createMut = useMutation({
    mutationFn: () => tasksApi.create(businessId, { title, priority }),
    onSuccess: () => {
      setTitle("");
      setPriority("medium");
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
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
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
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? <Spinner /> : "הוסף"}
          </Button>
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
            title="אין תזכורות עדיין"
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
              onRemove={() => removeMut.mutate(task.id)}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-navy-400 mb-3">
            הושלמו ({done.length})
          </h2>
          <div className="space-y-2.5 opacity-60">
            {done.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleMut.mutate(task)}
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
  onRemove,
}: {
  task: Task;
  onToggle: () => void;
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
      </div>
      <Badge tone={PRIORITY_TONE[task.priority]} className="shrink-0">
        {PRIORITY_LABEL[task.priority]}
      </Badge>
      {task.source !== "manual" && (
        <Badge tone="neutral" className="shrink-0 hidden sm:inline-flex">
          {SOURCE_LABEL[task.source]}
        </Badge>
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

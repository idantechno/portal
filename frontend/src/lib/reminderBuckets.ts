export type ReminderBucket = "overdue" | "today" | "soon" | "later" | "none";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Buckets a due date by the owner's local calendar day (their browser is in
 * Israel): overdue / today / soon (next 7 days) / later / none.
 */
export function bucketOf(dueAt: string | null): ReminderBucket {
  if (!dueAt) return "none";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "none";
  const t = dayKey(new Date());
  const dk = dayKey(due);
  if (dk < t) return "overdue";
  if (dk === t) return "today";
  const diff = (Date.parse(dk) - Date.parse(t)) / 86_400_000;
  return diff <= 7 ? "soon" : "later";
}

export const BUCKET_LABEL: Record<ReminderBucket, string> = {
  overdue: "באיחור",
  today: "היום",
  soon: "בקרוב",
  later: "בהמשך",
  none: "ללא תאריך",
};

export const BUCKET_ORDER: ReminderBucket[] = [
  "overdue",
  "today",
  "soon",
  "later",
  "none",
];

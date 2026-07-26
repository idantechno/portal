import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  appointmentsApi,
  waitlistApi,
  type Appointment,
  type AppointmentStatus,
  type WaitlistEntry,
} from "../../api/appointments";
import { apiErrorMessage } from "../../api/client";
import { Button, Card, EmptyState, Spinner } from "../../components/ui";
import { Icon } from "../../components/icons";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayHeading(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return "היום";
  if (sameDay(d, tomorrow)) return "מחר";
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

const APPT_TONE: Record<AppointmentStatus, string> = {
  scheduled: "bg-brand-50 text-brand-700",
  completed: "bg-teal-100 text-teal-800",
  no_show: "bg-neutral-100 text-neutral-500",
  cancelled: "bg-neutral-100 text-neutral-500",
};
const APPT_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "מתוזמן",
  completed: "בוצע",
  no_show: "לא הגיע",
  cancelled: "בוטל",
};

export default function Appointments() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appointments = useQuery({
    queryKey: ["appointments", businessId, "scheduled"],
    queryFn: () =>
      appointmentsApi.list(businessId, { status: "scheduled" }),
    enabled: Boolean(businessId),
  });

  const waitlist = useQuery({
    queryKey: ["waitlist", businessId],
    queryFn: () => waitlistApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["appointments", businessId] });
    qc.invalidateQueries({ queryKey: ["waitlist", businessId] });
  };

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: AppointmentStatus }) =>
      appointmentsApi.setStatus(businessId, v.id, v.status),
    onSuccess: refresh,
    onError: (e) => setError(apiErrorMessage(e, "הפעולה נכשלה")),
  });

  const cancelAppt = useMutation({
    mutationFn: (id: string) => appointmentsApi.cancel(businessId, id),
    onSuccess: refresh,
    onError: (e) => setError(apiErrorMessage(e, "הביטול נכשל")),
  });

  const cancelWait = useMutation({
    mutationFn: (id: string) => waitlistApi.cancel(businessId, id),
    onSuccess: refresh,
    onError: (e) => setError(apiErrorMessage(e, "ההסרה נכשלה")),
  });

  const appts = (appointments.data ?? []).filter(
    (a) => a.status === "scheduled",
  );
  // Group upcoming appointments by day for readable separators.
  const groups: Array<{ day: string; items: Appointment[] }> = [];
  for (const a of appts) {
    const day = dayHeading(a.startAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(a);
    else groups.push({ day, items: [a] });
  }

  const activeWait = (waitlist.data ?? []).filter(
    (w) => w.status === "waiting" || w.status === "offered",
  );

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">ניהול תורים</h1>
          <p className="text-neutral-600 text-sm">
            כל התורים הקרובים ורשימת ההמתנה. תור שמתבטל מוצע אוטומטית לבא בתור.
          </p>
        </div>
        <Button icon="plus" onClick={() => setShowAdd(true)}>
          תור חדש
        </Button>
      </header>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Upcoming appointments */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-neutral-500 mb-3">
          תורים קרובים
        </h2>
        {appointments.isLoading && (
          <div className="text-neutral-500 text-sm">טוען…</div>
        )}
        {!appointments.isLoading && appts.length === 0 && (
          <Card className="p-8">
            <EmptyState
              icon="clock"
              title="אין תורים קרובים"
              text="תורים שהסוכן יקבע — או שתוסיף ידנית — יופיעו כאן."
            />
          </Card>
        )}
        {groups.map((g) => (
          <div key={g.day} className="mb-4">
            <div className="text-xs font-medium text-neutral-400 mb-2">
              {g.day}
            </div>
            <div className="space-y-2">
              {g.items.map((a) => (
                <Card key={a.id} className="p-3 flex items-center gap-3">
                  <div className="rounded-xl bg-brand-50 text-brand-700 p-2 shrink-0">
                    <Icon name="clock" size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {a.title}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {fmt(a.startAt)}
                      {a.customerName ? ` · ${a.customerName}` : ""}
                      {a.phone ? (
                        <span dir="ltr"> · {a.phone}</span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`hidden sm:inline-block rounded-full text-[10px] px-2 py-0.5 font-medium ${APPT_TONE[a.status]}`}
                  >
                    {APPT_LABEL[a.status]}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setStatus.mutate({ id: a.id, status: "completed" })
                      }
                      disabled={setStatus.isPending}
                    >
                      בוצע
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setStatus.mutate({ id: a.id, status: "no_show" })
                      }
                      disabled={setStatus.isPending}
                    >
                      לא הגיע
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelAppt.mutate(a.id)}
                      disabled={cancelAppt.isPending}
                    >
                      ביטול
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Waitlist */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-500 mb-3">
          רשימת המתנה
        </h2>
        {waitlist.isLoading && (
          <div className="text-neutral-500 text-sm">טוען…</div>
        )}
        {!waitlist.isLoading && activeWait.length === 0 && (
          <Card className="p-8">
            <EmptyState
              icon="hourglass"
              title="רשימת ההמתנה ריקה"
              text="לקוחות שירצו תור תפוס יתווספו כאן, ויקבלו הודעה כשמתפנה מקום."
            />
          </Card>
        )}
        <div className="space-y-2">
          {activeWait.map((w: WaitlistEntry) => (
            <Card key={w.id} className="p-3 flex items-center gap-3">
              <div className="rounded-xl bg-amber-50 text-amber-700 p-2 shrink-0">
                <Icon name="hourglass" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{w.service}</div>
                <div className="text-xs text-neutral-500">
                  {w.customerName ?? "לקוח"}
                  {w.phone ? <span dir="ltr"> · {w.phone}</span> : null}
                  {w.preferredFrom ? ` · מ־${fmt(w.preferredFrom)}` : ""}
                </div>
              </div>
              {w.status === "offered" && (
                <span className="rounded-full text-[10px] px-2 py-0.5 font-medium bg-brand-50 text-brand-700">
                  הוצע תור
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cancelWait.mutate(w.id)}
                disabled={cancelWait.isPending}
              >
                הסר
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {showAdd && (
        <AddAppointment
          businessId={businessId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function AddAppointment({
  businessId,
  onClose,
  onSaved,
}: {
  businessId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      appointmentsApi.create(businessId, {
        title: title.trim(),
        start,
        customerName: customerName.trim() || undefined,
        phone: phone.trim() || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e, "השמירה נכשלה")),
  });

  const canSave = title.trim() && start;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-e3 w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg mb-4">תור חדש</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              פרטי התור
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל תספורת / טיפול פנים"
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              מועד (שעון ישראל)
            </label>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              dir="ltr"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                שם הלקוח
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                טלפון
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                dir="ltr"
              />
            </div>
          </div>
          {error && <div className="text-xs text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
              ביטול
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={!canSave || save.isPending}
            >
              {save.isPending ? (
                <>
                  <Spinner /> שומר…
                </>
              ) : (
                "שמור"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

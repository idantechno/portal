import { useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../../api/businesses";
import { apiErrorMessage } from "../../api/client";
import type {
  Business,
  WhatsappAgentConfig,
  WhatsappAgentMode,
} from "../../api/types";
import { Button, Spinner } from "../../components/ui";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"]; // Sun … Sat

const MODES: Array<{
  value: WhatsappAgentMode;
  title: string;
  desc: string;
}> = [
  {
    value: "always",
    title: "תמיד פעיל",
    desc: "הסוכן עונה 24/7 לכל הודעה נכנסת.",
  },
  {
    value: "scheduled",
    title: "מתוזמן",
    desc: "הסוכן עונה רק בשעות שתגדיר. בשאר הזמן אתה עונה ידנית.",
  },
  {
    value: "off",
    title: "כבוי",
    desc: "הסוכן לא עונה בכלל בוואטסאפ — הכל ידני.",
  },
];

function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-e3 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default function AgentScheduleSettings({
  onClose,
}: {
  onClose: () => void;
}) {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const business = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });

  return (
    <Modal onClose={onClose}>
      {business.isLoading || !business.data ? (
        <div className="p-10 grid place-items-center">
          <Spinner />
        </div>
      ) : (
        <Form
          business={business.data}
          businessId={businessId}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function Form({
  business,
  businessId,
  onClose,
}: {
  business: Business;
  businessId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const cfg = business.whatsappAgent ?? null;
  const win = cfg?.windows?.[0];

  const [mode, setMode] = useState<WhatsappAgentMode>(cfg?.mode ?? "always");
  const [start, setStart] = useState(win?.start ?? "18:00");
  const [end, setEnd] = useState(win?.end ?? "09:00");
  const [days, setDays] = useState<number[]>(win?.days ?? ALL_DAYS);
  const [autoReturn, setAutoReturn] = useState<number>(
    cfg?.autoReturnHours ?? 6,
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const payload: WhatsappAgentConfig =
        mode === "scheduled"
          ? {
              mode,
              timezone: "Asia/Jerusalem",
              windows: [{ days: [...days].sort(), start, end }],
              autoReturnHours: autoReturn,
            }
          : { mode, autoReturnHours: autoReturn };
      return businessesApi.update(businessId, { whatsappAgent: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business", businessId] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, "השמירה נכשלה")),
  });

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const overnight = mode === "scheduled" && end <= start;

  return (
    <div className="p-6">
      <header className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-bold">הגדרות סוכן הצ'אט</h2>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
          aria-label="סגור"
        >
          ×
        </button>
      </header>
      <p className="text-xs text-neutral-500 mb-5">
        השליטה כאן חלה על <strong>וואטסאפ</strong> בלבד. בצ'אט באתר הסוכן עונה
        תמיד.
      </p>

      {/* Mode */}
      <div className="space-y-2 mb-5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`w-full text-start rounded-xl border p-3 transition ${
              mode === m.value
                ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
                : "border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <div className="font-semibold text-sm">{m.title}</div>
            <div className="text-xs text-neutral-500 mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Scheduled details */}
      {mode === "scheduled" && (
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 mb-5 space-y-4">
          <div>
            <div className="text-xs font-medium text-neutral-600 mb-2">
              שעות פעילות הסוכן (שעון ישראל)
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-neutral-600">מ־</label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                dir="ltr"
              />
              <label className="text-sm text-neutral-600">עד</label>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                dir="ltr"
              />
            </div>
            {overnight && (
              <div className="text-[11px] text-brand-700 mt-1.5">
                חלון לילה — הסוכן פעיל מ־{start} בערב ועד {end} למחרת בבוקר.
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-neutral-600 mb-2">
              בימים
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`size-9 rounded-lg text-sm font-medium transition ${
                    days.includes(d)
                      ? "bg-brand-600 text-white"
                      : "bg-white border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Auto-return */}
      <div className="rounded-xl border border-neutral-200 p-4 mb-5">
        <div className="text-sm font-medium text-neutral-700 mb-1">
          החזרה אוטומטית לסוכן
        </div>
        <p className="text-xs text-neutral-500 mb-3">
          שיחה שאתה מטפל בה ידנית תחזור לסוכן אוטומטית אחרי תקופת שקט — כדי שאם
          הלקוח חוזר מאוחר יותר, הוא יקבל מענה.
        </p>
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600">אחרי</label>
          <input
            type="number"
            min={0}
            max={168}
            value={autoReturn}
            onChange={(e) => setAutoReturn(Number(e.target.value) || 0)}
            className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            dir="ltr"
          />
          <span className="text-sm text-neutral-600">שעות של שקט</span>
        </div>
        <div className="text-[11px] text-neutral-400 mt-1">
          0 = מבוטל (השיחה נשארת ידנית עד שתחזיר אותה בעצמך).
        </div>
      </div>

      {error && <div className="text-xs text-red-700 mb-3">{error}</div>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
          ביטול
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
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
  );
}

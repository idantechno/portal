import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../../../api/businesses";
import { apiErrorMessage } from "../../../api/client";
import type {
  AvailabilityWindow,
  Business,
  BusinessAvailability,
} from "../../../api/types";
import { Button, Spinner } from "../../../components/ui";
import { Icon } from "../../../components/icons";

const DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** One editable row per weekday — the UI shape; saved back as windows. */
interface DayRow {
  open: boolean;
  start: string;
  end: string;
}

/** Default week: open Sun–Thu 09:00–17:00, closed Fri & Sat (Israeli default). */
function defaultRows(): DayRow[] {
  return DAY_LABELS.map((_, d) => ({
    open: d >= 0 && d <= 4,
    start: "09:00",
    end: "17:00",
  }));
}

/** Build 7 day-rows from the saved windows (first window covering each day). */
function rowsFromConfig(config: BusinessAvailability | null | undefined): DayRow[] {
  const rows = defaultRows();
  if (!config?.windows?.length) {
    // No windows yet → start every day closed so the owner opts in explicitly
    // (unless they've never configured, in which case keep the sensible week).
    if (config) return rows.map((r) => ({ ...r, open: false }));
    return rows;
  }
  for (let d = 0; d < 7; d++) {
    const win = config.windows.find((w) => w.days?.includes(d));
    rows[d] = win
      ? { open: true, start: win.start, end: win.end }
      : { open: false, start: rows[d].start, end: rows[d].end };
  }
  return rows;
}

/** Collapse the 7 rows into windows (one per open day). */
function rowsToWindows(rows: DayRow[]): AvailabilityWindow[] {
  const out: AvailabilityWindow[] = [];
  rows.forEach((r, d) => {
    if (r.open) out.push({ days: [d], start: r.start, end: r.end });
  });
  return out;
}

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

export default function BusinessHoursSettings({
  businessId,
  onClose,
}: {
  businessId: string;
  onClose: () => void;
}) {
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
  const cfg = business.availability ?? null;

  const [enabled, setEnabled] = useState<boolean>(cfg?.enabled ?? false);
  const [rows, setRows] = useState<DayRow[]>(() => rowsFromConfig(cfg));
  const [buffer, setBuffer] = useState<number>(cfg?.bufferMinutes ?? 0);
  const [daysOff, setDaysOff] = useState<string[]>(cfg?.daysOff ?? []);
  const [newDayOff, setNewDayOff] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const payload: BusinessAvailability = {
        enabled,
        timezone: "Asia/Jerusalem",
        windows: rowsToWindows(rows),
        bufferMinutes: buffer > 0 ? buffer : 0,
        daysOff: [...daysOff].sort(),
      };
      return businessesApi.update(businessId, { availability: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business", businessId] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, "השמירה נכשלה")),
  });

  const setRow = (d: number, patch: Partial<DayRow>) =>
    setRows((prev) => prev.map((r, i) => (i === d ? { ...r, ...patch } : r)));

  const addDayOff = () => {
    const v = newDayOff.trim();
    if (!v || daysOff.includes(v)) return;
    setDaysOff((prev) => [...prev, v]);
    setNewDayOff("");
  };

  return (
    <div className="p-6">
      <header className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-bold">שעות פעילות</h2>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
          aria-label="סגור"
        >
          ×
        </button>
      </header>
      <p className="text-xs text-neutral-500 mb-5">
        השעות שבהן העסק מקבל תורים. הסוכן יקבע ויציע ללקוחות רק בתוך השעות האלה.
        קביעה ידנית שלך לא מוגבלת בשעות.
      </p>

      {/* Master toggle */}
      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-neutral-200 p-4 mb-5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 size-4 accent-brand-600"
        />
        <span>
          <span className="text-sm font-medium text-neutral-700">
            אכוף שעות פעילות
          </span>
          <p className="text-xs text-neutral-500 mt-0.5">
            כשכבוי — הסוכן יכול לקבוע תור בכל שעה. כשמופעל — רק בשעות ובימים
            שתגדיר למטה.
          </p>
        </span>
      </label>

      {enabled && (
        <>
          {/* Weekly hours */}
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 mb-5">
            <div className="text-xs font-medium text-neutral-600 mb-3">
              שעות פתיחה (שעון ישראל)
            </div>
            <div className="space-y-2">
              {rows.map((r, d) => (
                <div key={d} className="flex items-center gap-2">
                  <label className="flex items-center gap-2 w-24 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.open}
                      onChange={(e) => setRow(d, { open: e.target.checked })}
                      className="size-4 accent-brand-600"
                    />
                    <span className="text-sm text-neutral-700">
                      {DAY_LABELS[d]}
                    </span>
                  </label>
                  {r.open ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={r.start}
                        onChange={(e) => setRow(d, { start: e.target.value })}
                        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                        dir="ltr"
                      />
                      <span className="text-neutral-400 text-sm">–</span>
                      <input
                        type="time"
                        value={r.end}
                        onChange={(e) => setRow(d, { end: e.target.value })}
                        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                        dir="ltr"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400">סגור</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Buffer */}
          <div className="rounded-xl border border-neutral-200 p-4 mb-5">
            <div className="text-sm font-medium text-neutral-700 mb-1">
              מרווח בין תורים
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              זמן פנוי לפני ואחרי כל תור, כדי לא לקבוע תורים צמודים.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={240}
                step={5}
                value={buffer}
                onChange={(e) => setBuffer(Number(e.target.value) || 0)}
                className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                dir="ltr"
              />
              <span className="text-sm text-neutral-600">דקות</span>
            </div>
          </div>

          {/* Days off */}
          <div className="rounded-xl border border-neutral-200 p-4 mb-5">
            <div className="text-sm font-medium text-neutral-700 mb-1">
              ימי סגירה
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              תאריכים ספציפיים שהעסק סגור בהם (חגים, חופשה). בתאריכים אלה הסוכן
              לא יקבע תורים.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="date"
                value={newDayOff}
                onChange={(e) => setNewDayOff(e.target.value)}
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                dir="ltr"
              />
              <Button
                variant="ghost"
                size="sm"
                icon="plus"
                onClick={addDayOff}
                disabled={!newDayOff}
              >
                הוסף
              </Button>
            </div>
            {daysOff.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[...daysOff].sort().map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
                  >
                    <span dir="ltr">{d}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDaysOff((prev) => prev.filter((x) => x !== d))
                      }
                      className="text-neutral-400 hover:text-red-600"
                      aria-label="הסר"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

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

import { useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { Icon, type IconName } from "../../components/icons";
import MonthSection from "./calendar/MonthSection";
import AppointmentsSection from "./calendar/AppointmentsSection";
import TasksSection from "./calendar/TasksSection";
import RemindersSection from "./calendar/RemindersSection";
import DayAgendaSection from "./calendar/DayAgendaSection";

type View = "today" | "week" | "month" | "appointments" | "tasks" | "reminders";

/** The calendar timeframe — one clean "תצוגה" switch instead of a tab + a
 *  hidden toggle. */
const VIEWS: { key: "today" | "week" | "month"; label: string }[] = [
  { key: "today", label: "יום" },
  { key: "week", label: "שבוע" },
  { key: "month", label: "חודש" },
];

/** The item lists — a separate axis from the calendar timeframe. */
const LISTS: { key: "appointments" | "tasks" | "reminders"; label: string; icon: IconName }[] = [
  { key: "appointments", label: "פגישות ותורים", icon: "clock" },
  { key: "tasks", label: "משימות", icon: "tasks" },
  { key: "reminders", label: "תזכורות", icon: "bell" },
];

function readView(param: string | null): View {
  if (param === "week") return "week";
  if (param === "month") return "month";
  if (param === "appointments") return "appointments";
  if (param === "tasks") return "tasks";
  if (param === "reminders") return "reminders";
  return "today";
}

/**
 * Unified "יומן" screen — one place for the whole schedule. A "תצוגה" segmented
 * control switches the calendar timeframe (יום / שבוע / חודש); a second row of
 * tabs opens the item lists (פגישות ותורים, משימות, תזכורות). Each section keeps
 * its own queries/mutations; the old /appointments and /tasks routes redirect
 * here with a ?view= param so deep links and notifications keep working.
 */
export default function Calendar() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  // The URL is the single source of truth for the active view, so navigating
  // here from the sidebar (e.g. "משימות" → ?view=reminders) switches the tab
  // even when the Calendar is already mounted.
  const view = readView(searchParams.get("view"));

  const select = (next: View) => {
    const params = new URLSearchParams(searchParams);
    if (next === "today") params.delete("view");
    else params.set("view", next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
      <PageHeader
        title="יומן"
        subtitle="כל מה שמתוכנן במקום אחד — יום, שבוע, חודש, פגישות, משימות ותזכורות."
      />

      {/* תצוגה — the calendar timeframe as one clear segmented control. */}
      <div className="mb-5">
        <div className="mb-1.5 text-xs font-medium text-navy-400">תצוגה</div>
        <div className="inline-flex rounded-xl bg-navy-50 p-1 text-sm">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => select(v.key)}
              className={`rounded-lg px-5 py-1.5 font-medium transition ${
                view === v.key
                  ? "bg-white text-navy-900 shadow-e1"
                  : "text-navy-500 hover:text-navy-800"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lists — a second axis. touch-action:pan-x keeps a swipe on the strip
          horizontal so it can't drag the page up/down on mobile. */}
      <div className="mb-6 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-navy-100 [touch-action:pan-x]">
        {LISTS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => select(t.key)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
              view === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {view === "today" && (
        <DayAgendaSection businessId={businessId} range="today" />
      )}
      {view === "week" && (
        <DayAgendaSection businessId={businessId} range="week" />
      )}
      {view === "month" && <MonthSection businessId={businessId} />}
      {view === "appointments" && (
        <AppointmentsSection businessId={businessId} />
      )}
      {view === "tasks" && <TasksSection businessId={businessId} />}
      {view === "reminders" && <RemindersSection businessId={businessId} />}
    </div>
  );
}

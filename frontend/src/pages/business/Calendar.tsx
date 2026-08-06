import { useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { Icon, type IconName } from "../../components/icons";
import MonthSection from "./calendar/MonthSection";
import AppointmentsSection from "./calendar/AppointmentsSection";
import TasksSection from "./calendar/TasksSection";
import RemindersSection from "./calendar/RemindersSection";
import DayAgendaSection from "./calendar/DayAgendaSection";

type View = "today" | "month" | "appointments" | "tasks" | "reminders";

const TABS: { key: View; label: string; icon: IconName }[] = [
  { key: "today", label: "היום", icon: "compass" },
  { key: "month", label: "חודש", icon: "calendar" },
  { key: "appointments", label: "פגישות ותורים", icon: "clock" },
  { key: "tasks", label: "משימות", icon: "tasks" },
  { key: "reminders", label: "תזכורות", icon: "bell" },
];

function readView(param: string | null): View {
  if (param === "month") return "month";
  if (param === "appointments") return "appointments";
  if (param === "tasks") return "tasks";
  if (param === "reminders") return "reminders";
  return "today";
}

/**
 * Unified "יומן" screen — one place for the whole schedule. Three views:
 * חודש (month grid), פגישות ותורים (appointments + waitlist), and תזכורות
 * (task checklist). Each view is its own section component keeping its original
 * queries/mutations; the old /appointments and /tasks routes redirect here with
 * a ?view= param so deep links and notifications keep working.
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
        subtitle="כל מה שמתוכנן במקום אחד — חודש, פגישות ותורים, משימות ותזכורות."
      />

      {/* Tabs — matches the internal-tab pattern used across the agents. */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-navy-100">
        {TABS.map((t) => (
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

      {view === "today" && <DayAgendaSection businessId={businessId} />}
      {view === "month" && <MonthSection businessId={businessId} />}
      {view === "appointments" && (
        <AppointmentsSection businessId={businessId} />
      )}
      {view === "tasks" && <TasksSection businessId={businessId} />}
      {view === "reminders" && <RemindersSection businessId={businessId} />}
    </div>
  );
}

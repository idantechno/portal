import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { businessesApi } from "../../api/businesses";
import type { AgentListItem } from "../../api/types";
import { agentRoute } from "../../lib/agentRoutes";
import { useAuthStore } from "../../store/auth";
import { isPlatformStaff } from "../../lib/roles";
import { Card, EmptyState, PageHeader, Spinner, IconTile } from "../../components/ui";
import { Icon, hasIcon } from "../../components/icons";

// The single hub listing EVERY agent in the catalog. Entitled agents are active
// and open their own page; the rest render as dimmed "premium" cards a client
// can't open (the backend route guards enforce that too — the dimming is UI).
// Operators (platform staff / entered via staff) see everything as usable.
export default function AgentStudio() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const navigate = useNavigate();

  const agents = useQuery({
    queryKey: ["business", businessId, "agents"],
    queryFn: () => agentsApi.forBusiness(businessId),
    enabled: Boolean(businessId),
  });

  // Operator = platform staff, or a staff member who entered this business.
  const user = useAuthStore((s) => s.user);
  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });
  const isOperator =
    isPlatformStaff(user?.role) || (biz.data?.viaPlatformStaff ?? false);

  // Operator-only agents (e.g. AI updates) never show as cards for clients.
  const visible = (agents.data ?? []).filter(
    (a) => isOperator || !a.operatorOnly,
  );

  function open(agent: AgentListItem) {
    const to = agentRoute(agent.key, businessId);
    if (to) navigate(to);
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="הסוכנים שלך"
        subtitle="כל הסוכנים של העסק במקום אחד — בחר סוכן כדי לפתוח את הדף שלו."
      />

      {agents.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {!agents.isLoading && visible.length === 0 && (
        <Card>
          <EmptyState
            icon="agents"
            title="עדיין אין סוכנים זמינים"
            text="פנה למנהל המערכת כדי להפעיל סוכנים לעסק הזה."
          />
        </Card>
      )}

      {visible.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((agent) => {
            // Operators may use every agent; clients only their entitled ones.
            const active = isOperator || agent.entitled;
            const iconName = hasIcon(agent.icon) ? agent.icon : "agents";

            const body = (
              <Card
                className={[
                  "h-full p-4 transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-brand)]",
                  active
                    ? "group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-e3)]"
                    : "opacity-45 saturate-[0.65]",
                ].join(" ")}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <IconTile icon={iconName} tone="brand" />
                  {active ? (
                    <Icon
                      name="chevron-start"
                      size={18}
                      className="mt-1 text-navy-300 transition-colors group-hover:text-navy-500"
                    />
                  ) : (
                    <span
                      className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        color: "var(--brand-tag, var(--brand-accent))",
                        backgroundColor:
                          "color-mix(in srgb, var(--brand-tag, var(--brand-accent)) 12%, transparent)",
                      }}
                    >
                      <Icon name="crown" size={13} />
                      פרמיום
                    </span>
                  )}
                </div>
                <div className="mb-0.5 text-sm font-semibold text-navy-900">
                  {agent.name}
                </div>
                <div className="text-xs text-navy-400">{agent.description}</div>
              </Card>
            );

            return active ? (
              <button
                key={agent.key}
                onClick={() => open(agent)}
                className="group block text-start"
              >
                {body}
              </button>
            ) : (
              <div
                key={agent.key}
                className="cursor-not-allowed"
                title="סוכן פרמיום — פנה למנהל להפעלה"
                aria-disabled="true"
              >
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { businessesApi } from "../../api/businesses";
import type { AgentDefinition } from "../../api/types";
import { agentRoute } from "../../lib/agentRoutes";
import { useAuthStore } from "../../store/auth";
import { isPlatformStaff } from "../../lib/roles";
import { Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { Icon, ServerIcon } from "../../components/icons";

// The single hub listing every agent the business has. Clicking any card opens
// that agent's OWN page (chat + its structured tools). No agent is operated
// inline here anymore — one agent, one page.
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
  const allAgents = (agents.data ?? []).filter(
    (a) => isOperator || !a.operatorOnly,
  );

  function open(agent: AgentDefinition) {
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
      {!agents.isLoading && allAgents.length === 0 && (
        <Card>
          <EmptyState
            icon="agents"
            title="עדיין לא הוקצו סוכנים"
            text="פנה למנהל המערכת כדי להפעיל סוכנים לעסק הזה."
          />
        </Card>
      )}

      {allAgents.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allAgents.map((agent) => (
            <button
              key={agent.key}
              onClick={() => open(agent)}
              className="group relative rounded-2xl border border-navy-100/70 bg-white p-4 text-start shadow-[var(--shadow-e1)] transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-brand)] hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[var(--shadow-e3)]"
            >
              <div className="mb-2 flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 transition-colors group-hover:bg-brand-100">
                  <ServerIcon name={agent.icon} size={21} />
                </span>
                <Icon
                  name="chevron-start"
                  size={18}
                  className="mt-1 text-brand-200 transition-colors group-hover:text-brand-500 rtl:-scale-x-100"
                />
              </div>
              <div className="font-semibold text-navy-900 text-sm mb-0.5">
                {agent.name}
              </div>
              <div className="text-xs text-navy-400">{agent.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

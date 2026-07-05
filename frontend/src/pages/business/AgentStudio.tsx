import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import type { AgentDefinition } from "../../api/types";
import { agentRoute } from "../../lib/agentRoutes";
import { Card } from "../../components/ui";

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

  const allAgents = agents.data ?? [];

  function open(agent: AgentDefinition) {
    const to = agentRoute(agent.key, businessId);
    if (to) navigate(to);
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900 mb-1">הסוכנים שלך</h1>
        <p className="text-navy-500 text-sm">
          כל הסוכנים של העסק במקום אחד — בחר סוכן כדי לפתוח את הדף שלו.
        </p>
      </header>

      {agents.isLoading && <div className="text-navy-400 text-sm">טוען...</div>}
      {!agents.isLoading && allAgents.length === 0 && (
        <Card className="p-12 text-center text-navy-400">
          עדיין לא הוקצו לעסק סוכנים. פנה למנהל המערכת כדי להפעיל.
        </Card>
      )}

      {allAgents.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allAgents.map((agent) => (
            <button
              key={agent.key}
              onClick={() => open(agent)}
              className="group relative text-start rounded-2xl border border-navy-100 bg-white p-4 transition-all hover:border-brand-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-20px_rgba(1,20,39,0.4)]"
            >
              <div className="flex items-start justify-between">
                <div className="text-2xl mb-2" aria-hidden>
                  {agent.icon}
                </div>
                <span className="text-brand-300 text-lg rtl:rotate-180 group-hover:text-brand-500 transition-colors">
                  →
                </span>
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

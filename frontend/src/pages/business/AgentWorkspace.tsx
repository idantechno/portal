import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { Spinner } from "../../components/ui";
import GenericAgentWorkspace from "./GenericAgentWorkspace";
import MainAgent from "./MainAgent";
import DocumentsAgent from "./DocumentsAgent";
import DesignerAgent from "./DesignerAgent";
import IdeasAgent from "./IdeasAgent";
import RemindersAgent from "./RemindersAgent";
import MarketingAgent from "./MarketingAgent";

// Agents that keep a bespoke, richer page. Every other entitled agent falls
// through to the uniform GenericAgentWorkspace. This is the single dispatcher
// behind /app/businesses/:businessId/agents/:agentKey — one route, every agent.
const BESPOKE: Record<
  string,
  (props: { businessId: string }) => React.ReactElement
> = {
  main: MainAgent,
  documents: DocumentsAgent,
  designer: DesignerAgent,
  ideas: IdeasAgent,
  reminders: RemindersAgent,
  marketing: MarketingAgent,
};

export default function AgentWorkspace() {
  const { businessId = "", agentKey = "" } = useParams<{
    businessId: string;
    agentKey: string;
  }>();

  const agents = useQuery({
    queryKey: ["business", businessId, "agents"],
    queryFn: () => agentsApi.forBusiness(businessId),
    enabled: Boolean(businessId),
  });

  // The WhatsApp/widget bot's "page" is the live inbox.
  if (agentKey === "chat") {
    return <Navigate to={`/app/businesses/${businessId}/inbox`} replace />;
  }

  // "orchestrator" was folded into the Main agent — keep old links/bookmarks alive.
  if (agentKey === "orchestrator") {
    return (
      <Navigate to={`/app/businesses/${businessId}/agents/main`} replace />
    );
  }

  const Bespoke = BESPOKE[agentKey];
  if (Bespoke) return <Bespoke businessId={businessId} />;

  if (agents.isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Spinner />
      </div>
    );
  }

  const def = (agents.data ?? []).find((a) => a.key === agentKey);
  if (!def) {
    // Not entitled or unknown key — send back to the hub.
    return (
      <Navigate to={`/app/businesses/${businessId}/agents`} replace />
    );
  }

  return (
    <GenericAgentWorkspace
      businessId={businessId}
      agentKey={agentKey}
      name={def.name}
      icon={def.icon}
    />
  );
}

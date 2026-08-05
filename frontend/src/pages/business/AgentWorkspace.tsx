import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { businessesApi } from "../../api/businesses";
import { useAuthStore } from "../../store/auth";
import { isPlatformStaff } from "../../lib/roles";
import { Spinner } from "../../components/ui";
import GenericAgentWorkspace from "./GenericAgentWorkspace";
import MainAgent from "./MainAgent";
import DocumentsAgent from "./DocumentsAgent";
import DesignerAgent from "./DesignerAgent";
import IdeasAgent from "./IdeasAgent";
import RemindersAgent from "./RemindersAgent";
import MarketingAgent from "./MarketingAgent";
import QuoteAgent from "./QuoteAgent";
import AiUpdatesAgent from "./AiUpdatesAgent";
import MailAgent from "./MailAgent";

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
  quote: QuoteAgent,
  "ai-updates": AiUpdatesAgent,
  email: MailAgent,
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

  // Operator = platform staff, or a staff member who entered this business.
  const user = useAuthStore((s) => s.user);
  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });
  const isOperator =
    isPlatformStaff(user?.role) || (biz.data?.viaPlatformStaff ?? false);

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

  // Operator-only agents (e.g. AI updates) are unreachable for clients even by
  // deep link — bounce them back to the hub. The backend gates the data too.
  const requested = (agents.data ?? []).find((a) => a.key === agentKey);
  if (requested?.operatorOnly && !isOperator) {
    return <Navigate to={`/app/businesses/${businessId}/agents`} replace />;
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

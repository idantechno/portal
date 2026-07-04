/**
 * Maps an agent key to the in-app route that opens it. Standalone agents have
 * their own top-level page; chat opens the business inbox; other generative
 * agents open the agent studio inside the business. Returns undefined when a
 * business-scoped agent has no business to route to.
 */
export function agentRoute(
  key: string,
  businessId?: string,
): string | undefined {
  if (key === "main") return "/app/agents/main";
  if (key === "documents") return "/app/agents/documents";
  if (key === "ideas") return "/app/agents/ideas";
  if (key === "designer") return "/app/agents/designer";
  if (key === "reminders") return "/app/agents/reminders";
  if (key === "chat")
    return businessId ? `/app/businesses/${businessId}/inbox` : undefined;
  return businessId ? `/app/businesses/${businessId}/agents` : undefined;
}

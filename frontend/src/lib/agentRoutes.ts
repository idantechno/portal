/**
 * Uniform routing: every agent opens its OWN page under the business cockpit at
 * /app/businesses/:id/agents/:key — an agent is an agent, a page is a page. The
 * chat agent's page carries its settings and links out to שיחות (the inbox);
 * it no longer redirects there. Returns undefined when there is no business to
 * scope to.
 */
export function agentRoute(
  key: string,
  businessId?: string,
): string | undefined {
  if (!businessId) return undefined;
  return `/app/businesses/${businessId}/agents/${key}`;
}

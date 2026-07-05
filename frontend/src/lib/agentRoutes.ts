/**
 * Uniform routing: every agent opens its OWN page under the business cockpit at
 * /app/businesses/:id/agents/:key. The one exception is `chat` — the WhatsApp/
 * widget bot — whose "page" is the live inbox. Returns undefined when there is
 * no business to scope to.
 */
export function agentRoute(
  key: string,
  businessId?: string,
): string | undefined {
  if (!businessId) return undefined;
  if (key === "chat") return `/app/businesses/${businessId}/inbox`;
  return `/app/businesses/${businessId}/agents/${key}`;
}

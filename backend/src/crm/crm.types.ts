/** Decrypted config for a webhook destination. */
export interface WebhookDestinationConfig {
  /** Where to POST the event. Must be a public https URL. */
  url: string;
  /** Optional shared secret — used to HMAC-sign the body (X-Portal-Signature). */
  secret?: string;
}

/** A normalized event we push to a business's external destination. */
export interface CrmSyncEvent {
  event: 'lead.created' | 'appointment.created';
  business: { id: string; name: string };
  occurredAt: string;
  data: Record<string, unknown>;
}

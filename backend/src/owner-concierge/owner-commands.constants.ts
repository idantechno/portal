/**
 * BullMQ queue carrying owner-over-WhatsApp commands. Decouples the WhatsApp
 * webhook (producer) from the concierge (consumer) — the webhook enqueues and
 * acks instantly, a worker runs the (slow) agent + media download, and crucially
 * it breaks the module cycle WhatsApp → concierge → tasks → WhatsApp.
 */
export const OWNER_COMMANDS_QUEUE = 'owner-commands';

/** A command the owner sent — either free-form text or a media file to process. */
export type OwnerCommandJob =
  | {
      type: 'text';
      businessId: string;
      fromPhone: string;
      wamid: string;
      body: string;
    }
  | {
      type: 'media';
      businessId: string;
      fromPhone: string;
      wamid: string;
      mediaId: string;
      mimeType: string | null;
      fileName: string | null;
      caption: string | null;
    };

import { GmailMessage } from '../../integrations/gmail.service';

/**
 * A single triage rule. The mail agent is an ENGINE that runs every registered
 * detector over each fetched message; a detector only decides "is this message
 * one of mine?" — never parses amounts or vendors (that happens later, on
 * approval). Adding a future detector (documents, events, …) is just adding a
 * class that implements this interface and registering it in the service.
 */
export interface MailDetector {
  /** Stable slug stored on the created {@link MailItem} (e.g. 'invoice'). */
  key: string;
  /** True when this message is a candidate for this detector. */
  detect(msg: GmailMessage): { matched: boolean };
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GmailService } from '../integrations/gmail.service';
import { WhatsappConnectionsService } from '../whatsapp/whatsapp-connections.service';

const GRAPH_VERSION = 'v21.0';

export interface OperatorMessage {
  subject: string;
  /** Plain-text body for both email and WhatsApp. */
  text: string;
}

/**
 * Delivers a questionnaire submission to the operator (idant) out-of-band.
 *
 * - Email works today: it reuses the platform business's connected Gmail
 *   (`GmailService`) to send from/to the operator's business inbox. If Gmail
 *   isn't connected yet it logs and moves on.
 * - WhatsApp is a best-effort seam: it posts a text message from the platform
 *   WABA to `OPERATOR_NOTIFY_WHATSAPP`. This only succeeds once the Meta Cloud
 *   API is unblocked and (for business-initiated sends outside the 24h window)
 *   an approved template is used. Until then it simply logs.
 *
 * Every path is non-throwing — notifying the operator must never fail the
 * submission itself.
 */
@Injectable()
export class OperatorNotifierService {
  private readonly log = new Logger(OperatorNotifierService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly gmail: GmailService,
    private readonly waConns: WhatsappConnectionsService,
  ) {}

  async notify(
    platformBusinessId: string,
    message: OperatorMessage,
  ): Promise<void> {
    await this.sendEmail(platformBusinessId, message);
    await this.sendWhatsapp(platformBusinessId, message);
  }

  private async sendEmail(
    businessId: string,
    message: OperatorMessage,
  ): Promise<void> {
    const to = this.config.get<string>('OPERATOR_NOTIFY_EMAIL');
    if (!to) {
      this.log.warn('OPERATOR_NOTIFY_EMAIL not set — skipping operator email');
      return;
    }
    try {
      const { from } = await this.gmail.sendEmail(businessId, {
        to,
        subject: message.subject,
        body: message.text,
      });
      this.log.log(`Questionnaire emailed to operator (${to}) from ${from}`);
    } catch (err) {
      // Most commonly GMAIL_NOT_CONNECTED until the operator connects Gmail.
      this.log.warn(
        `Operator email failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async sendWhatsapp(
    businessId: string,
    message: OperatorMessage,
  ): Promise<void> {
    const to = this.config.get<string>('OPERATOR_NOTIFY_WHATSAPP');
    if (!to) return; // Not configured — WhatsApp notify is opt-in.

    try {
      const conn = await this.waConns.findByBusinessId(businessId);
      if (!conn || conn.status !== 'active' || !conn.phoneNumberId) {
        this.log.warn(
          'WhatsApp not connected for the platform business — skipping ' +
            'operator WhatsApp (email still sent). Enable once Meta is unblocked.',
        );
        return;
      }
      const token = this.waConns.decryptAccessToken(conn);
      const url = `https://graph.facebook.com/${GRAPH_VERSION}/${conn.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: message.text, preview_url: false },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.log.warn(
          `Operator WhatsApp send failed (HTTP ${res.status}): ${detail.slice(0, 200)}`,
        );
        return;
      }
      this.log.log(`Questionnaire sent to operator WhatsApp (${to})`);
    } catch (err) {
      this.log.warn(
        `Operator WhatsApp failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

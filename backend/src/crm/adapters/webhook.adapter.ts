import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { CrmConnection } from '../crm-connection.entity';
import { CrmAdapter } from './crm-adapter.interface';
import { CrmSyncEvent, WebhookDestinationConfig } from '../crm.types';

/**
 * The universal destination: POST the event as JSON to an owner-configured URL.
 * That URL can be the CRM's own inbound webhook, or a Zapier/Make hook that maps
 * the fields into any CRM. When a secret is set, the raw body is HMAC-SHA256
 * signed so the receiver can verify it came from Portal.
 */
@Injectable()
export class WebhookCrmAdapter implements CrmAdapter {
  readonly type = 'webhook';
  private readonly log = new Logger(WebhookCrmAdapter.name);

  async push(
    _connection: CrmConnection,
    config: Record<string, unknown>,
    event: CrmSyncEvent,
  ): Promise<void> {
    const { url, secret } = config as unknown as WebhookDestinationConfig;
    if (!url || !/^https:\/\//i.test(url)) {
      throw new Error('Webhook URL missing or not https');
    }

    const body = JSON.stringify(event);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Portal-Event': event.event,
    };
    if (secret) {
      const sig = createHmac('sha256', secret).update(body).digest('hex');
      headers['X-Portal-Signature'] = `sha256=${sig}`;
    }

    // Bound the wait so a slow endpoint never ties up the caller.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Destination responded ${res.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

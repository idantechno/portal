import { CrmConnection } from '../crm-connection.entity';
import { CrmSyncEvent } from '../crm.types';

/**
 * One destination kind (webhook today; a native CRM or Google Sheets later).
 * Mirrors the ChannelAdapter pattern: the CRM service dispatches through the
 * registry and never branches on destination type. `decryptedConfig` is the
 * plaintext JSON parsed from the connection's encrypted config.
 */
export interface CrmAdapter {
  /** Destination type this adapter serves (matches CrmConnection.type). */
  readonly type: string;

  /**
   * Deliver one event to the destination. Implementations should throw on
   * failure — the CrmService wraps calls so a failed push never breaks the
   * originating action (a lead is still captured even if the push fails).
   */
  push(
    connection: CrmConnection,
    decryptedConfig: Record<string, unknown>,
    event: CrmSyncEvent,
  ): Promise<void>;
}

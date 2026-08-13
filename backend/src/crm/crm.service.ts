import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService } from '../common/crypto/crypto.service';
import { BusinessesService } from '../businesses/businesses.service';
import { Lead } from '../leads/lead.entity';
import { Appointment } from '../appointments/appointment.entity';
import { CrmConnection, CrmDestinationType } from './crm-connection.entity';
import { CrmAdapter } from './adapters/crm-adapter.interface';
import { WebhookCrmAdapter } from './adapters/webhook.adapter';
import { CrmSyncEvent } from './crm.types';

/** Non-secret view of a connection, safe to return to the UI. */
export interface CrmConnectionView {
  type: CrmDestinationType;
  enabled: boolean;
  url: string;
  hasSecret: boolean;
  pushLeads: boolean;
  pushAppointments: boolean;
  updatedAt: Date;
}

export interface UpsertCrmInput {
  type?: CrmDestinationType;
  enabled?: boolean;
  url: string;
  /** New secret; omit to keep the existing one, empty string to clear it. */
  secret?: string;
  pushLeads?: boolean;
  pushAppointments?: boolean;
}

@Injectable()
export class CrmService {
  private readonly log = new Logger(CrmService.name);
  private readonly adapters: Map<string, CrmAdapter>;

  constructor(
    @InjectRepository(CrmConnection)
    private readonly connections: Repository<CrmConnection>,
    private readonly crypto: CryptoService,
    private readonly businesses: BusinessesService,
    webhookAdapter: WebhookCrmAdapter,
  ) {
    this.adapters = new Map([[webhookAdapter.type, webhookAdapter]]);
  }

  private getConnection(businessId: string): Promise<CrmConnection | null> {
    return this.connections.findOne({ where: { businessId } });
  }

  private readConfig(conn: CrmConnection): { url: string; secret?: string } {
    try {
      return JSON.parse(this.crypto.decrypt(conn.configEncrypted)) as {
        url: string;
        secret?: string;
      };
    } catch {
      return { url: '' };
    }
  }

  /** The business's destination as a non-secret view, or null if none set. */
  async view(businessId: string): Promise<CrmConnectionView | null> {
    const conn = await this.getConnection(businessId);
    if (!conn) return null;
    const cfg = this.readConfig(conn);
    return {
      type: conn.type,
      enabled: conn.enabled,
      url: cfg.url,
      hasSecret: Boolean(cfg.secret),
      pushLeads: conn.pushLeads,
      pushAppointments: conn.pushAppointments,
      updatedAt: conn.updatedAt,
    };
  }

  /** Create or update the business's destination. */
  async upsert(
    businessId: string,
    input: UpsertCrmInput,
  ): Promise<CrmConnectionView> {
    let conn = await this.getConnection(businessId);
    const existing = conn
      ? this.readConfig(conn)
      : { url: '', secret: undefined };

    // Keep the stored secret when the caller doesn't send one; an explicit
    // empty string clears it.
    const secret =
      input.secret === undefined ? existing.secret : input.secret || undefined;
    const configEncrypted = this.crypto.encrypt(
      JSON.stringify({ url: input.url, secret }),
    );

    if (!conn) {
      conn = this.connections.create({ businessId });
    }
    conn.type = input.type ?? 'webhook';
    conn.enabled = input.enabled ?? conn.enabled ?? true;
    conn.configEncrypted = configEncrypted;
    conn.pushLeads = input.pushLeads ?? conn.pushLeads ?? true;
    conn.pushAppointments =
      input.pushAppointments ?? conn.pushAppointments ?? true;
    await this.connections.save(conn);
    return (await this.view(businessId))!;
  }

  async remove(businessId: string): Promise<void> {
    await this.connections.delete({ businessId });
  }

  /**
   * Send a synthetic event so the owner can confirm their destination receives
   * data. Throws on failure so the controller can surface the reason.
   */
  async test(businessId: string): Promise<void> {
    const conn = await this.getConnection(businessId);
    if (!conn) throw new Error('לא הוגדר יעד חיצוני');
    const business = await this.businesses.findById(businessId);
    await this.dispatch(conn, {
      event: 'lead.created',
      business: { id: businessId, name: business?.name ?? '' },
      occurredAt: new Date().toISOString(),
      data: { test: true, name: 'בדיקה', interest: 'חיבור לדוגמה' },
    });
  }

  /** Push a newly captured lead. Best-effort — never throws. */
  async pushLead(lead: Lead): Promise<void> {
    try {
      const conn = await this.getConnection(lead.businessId);
      if (!conn || !conn.enabled || !conn.pushLeads) return;
      const business = await this.businesses.findById(lead.businessId);
      await this.dispatch(conn, {
        event: 'lead.created',
        business: { id: lead.businessId, name: business?.name ?? '' },
        occurredAt: new Date().toISOString(),
        data: {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          interest: lead.interest,
          notes: lead.notes,
          source: lead.source,
          sourceDetail: lead.sourceDetail,
          createdAt: lead.createdAt,
        },
      });
    } catch (err) {
      this.log.warn(
        `[crm] lead push failed for business ${lead.businessId}: ${(err as Error).message}`,
      );
    }
  }

  /** Push a newly booked appointment. Best-effort — never throws. */
  async pushAppointment(appointment: Appointment): Promise<void> {
    try {
      const conn = await this.getConnection(appointment.businessId);
      if (!conn || !conn.enabled || !conn.pushAppointments) return;
      const business = await this.businesses.findById(appointment.businessId);
      await this.dispatch(conn, {
        event: 'appointment.created',
        business: { id: appointment.businessId, name: business?.name ?? '' },
        occurredAt: new Date().toISOString(),
        data: {
          id: appointment.id,
          title: appointment.title,
          startAt: appointment.startAt,
          endAt: appointment.endAt,
          customerName: appointment.customerName,
          phone: appointment.phone,
          notes: appointment.notes,
          status: appointment.status,
          createdAt: appointment.createdAt,
        },
      });
    } catch (err) {
      this.log.warn(
        `[crm] appointment push failed for business ${appointment.businessId}: ${(err as Error).message}`,
      );
    }
  }

  private async dispatch(
    conn: CrmConnection,
    event: CrmSyncEvent,
  ): Promise<void> {
    const adapter = this.adapters.get(conn.type);
    if (!adapter) throw new Error(`No CRM adapter for type ${conn.type}`);
    const cfg = this.readConfig(conn);
    await adapter.push(conn, cfg, event);
  }
}

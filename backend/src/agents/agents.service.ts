import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BusinessesService } from '../businesses/businesses.service';
import { BusinessAgent } from './business-agent.entity';
import {
  AGENT_CATALOG,
  AgentDefinition,
  getAgentDefinition,
} from './agent-catalog';

export interface AgentAccessView extends AgentDefinition {
  enabled: boolean;
}

/**
 * Per-business agent entitlements. Access is "default deny" except that a
 * business with no explicit grant row for an agent falls back to that agent's
 * catalog `defaultEnabled` — so existing/new businesses keep the base agents
 * working until an admin explicitly grants or revokes (which writes a row).
 */
@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(BusinessAgent)
    private readonly agents: Repository<BusinessAgent>,
    private readonly businesses: BusinessesService,
  ) {}

  catalog(): readonly AgentDefinition[] {
    return AGENT_CATALOG;
  }

  private effectiveEnabled(
    key: string,
    row: BusinessAgent | undefined,
  ): boolean {
    if (row) return row.enabled;
    return getAgentDefinition(key)?.defaultEnabled ?? false;
  }

  private async rowsByKey(
    businessId: string,
  ): Promise<Map<string, BusinessAgent>> {
    const rows = await this.agents.find({ where: { businessId } });
    return new Map(rows.map((r) => [r.agentKey, r]));
  }

  async hasAccess(businessId: string, agentKey: string): Promise<boolean> {
    const row = await this.agents.findOne({
      where: { businessId, agentKey },
    });
    return this.effectiveEnabled(agentKey, row ?? undefined);
  }

  /** Full catalog merged with this business's effective state (admin view). */
  async accessForBusiness(businessId: string): Promise<AgentAccessView[]> {
    const byKey = await this.rowsByKey(businessId);
    return AGENT_CATALOG.map((a) => ({
      ...a,
      enabled: this.effectiveEnabled(a.key, byKey.get(a.key)),
    }));
  }

  /** Only the agents the business may actually use (business-facing). */
  async entitledForBusiness(businessId: string): Promise<AgentDefinition[]> {
    const byKey = await this.rowsByKey(businessId);
    return AGENT_CATALOG.filter((a) =>
      this.effectiveEnabled(a.key, byKey.get(a.key)),
    );
  }

  /**
   * Union of agents the user is entitled to across all businesses they belong
   * to — drives the dashboard tools. An agent shows if any of the user's
   * businesses has it effectively enabled.
   */
  async entitledForUser(userId: string): Promise<AgentDefinition[]> {
    const businesses = await this.businesses.listForUser(userId);
    if (businesses.length === 0) return [];
    const ids = businesses.map((b) => b.id);
    const rows = await this.agents.find({ where: { businessId: In(ids) } });
    // businessId -> (agentKey -> row)
    const byBusiness = new Map<string, Map<string, BusinessAgent>>();
    for (const r of rows) {
      const m = byBusiness.get(r.businessId) ?? new Map();
      m.set(r.agentKey, r);
      byBusiness.set(r.businessId, m);
    }
    return AGENT_CATALOG.filter((a) =>
      ids.some((id) => this.effectiveEnabled(a.key, byBusiness.get(id)?.get(a.key))),
    );
  }

  async setAccess(
    businessId: string,
    agentKey: string,
    enabled: boolean,
    grantedByUserId: string | null,
  ): Promise<BusinessAgent> {
    let row = await this.agents.findOne({ where: { businessId, agentKey } });
    if (row) {
      row.enabled = enabled;
      row.grantedByUserId = grantedByUserId;
    } else {
      row = this.agents.create({
        businessId,
        agentKey,
        enabled,
        grantedByUserId,
      });
    }
    return this.agents.save(row);
  }
}

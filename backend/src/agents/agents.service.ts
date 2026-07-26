import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BusinessesService } from '../businesses/businesses.service';
import { BillingService } from '../billing/billing.service';
import type { PlanCapability } from '../billing/plan-capabilities';
import { BusinessAgent } from './business-agent.entity';
import {
  AGENT_CATALOG,
  AGENT_REQUIRED_CAPABILITY,
  AgentDefinition,
  AgentKey,
} from './agent-catalog';

export interface AgentAccessView extends AgentDefinition {
  enabled: boolean;
}

/**
 * Per-business agent entitlements. Access is derived from the business's PLAN
 * (see `AGENT_REQUIRED_CAPABILITY`): each agent is on by default when the plan
 * unlocks its required capability. An explicit `business_agents` row overrides
 * that default BOTH ways — an admin can grant an above-plan agent to one
 * business or revoke an in-plan one, which is the manual escape hatch on top of
 * automatic plan-based access.
 */
@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(BusinessAgent)
    private readonly agents: Repository<BusinessAgent>,
    private readonly businesses: BusinessesService,
    private readonly billing: BillingService,
  ) {}

  catalog(): readonly AgentDefinition[] {
    return AGENT_CATALOG;
  }

  /**
   * Effective access for one agent given the business's capability set and any
   * explicit grant row. Explicit row wins (manual override); otherwise the agent
   * is on iff the plan includes its required capability (null = always on).
   */
  private effectiveEnabled(
    key: string,
    row: BusinessAgent | undefined,
    caps: Set<PlanCapability>,
  ): boolean {
    if (row) return row.enabled;
    const required = AGENT_REQUIRED_CAPABILITY[key as AgentKey];
    if (required === undefined) return false; // unknown agent → deny
    if (required === null) return true; // infra agent → always on
    return caps.has(required);
  }

  private async rowsByKey(
    businessId: string,
  ): Promise<Map<string, BusinessAgent>> {
    const rows = await this.agents.find({ where: { businessId } });
    return new Map(rows.map((r) => [r.agentKey, r]));
  }

  async hasAccess(businessId: string, agentKey: string): Promise<boolean> {
    const [row, caps] = await Promise.all([
      this.agents.findOne({ where: { businessId, agentKey } }),
      this.billing.getCapabilities(businessId),
    ]);
    return this.effectiveEnabled(agentKey, row ?? undefined, caps);
  }

  /** Full catalog merged with this business's effective state (admin view). */
  async accessForBusiness(businessId: string): Promise<AgentAccessView[]> {
    const [byKey, caps] = await Promise.all([
      this.rowsByKey(businessId),
      this.billing.getCapabilities(businessId),
    ]);
    return AGENT_CATALOG.map((a) => ({
      ...a,
      enabled: this.effectiveEnabled(a.key, byKey.get(a.key), caps),
    }));
  }

  /** Only the agents the business may actually use (business-facing). */
  async entitledForBusiness(businessId: string): Promise<AgentDefinition[]> {
    const [byKey, caps] = await Promise.all([
      this.rowsByKey(businessId),
      this.billing.getCapabilities(businessId),
    ]);
    return AGENT_CATALOG.filter((a) =>
      this.effectiveEnabled(a.key, byKey.get(a.key), caps),
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
      const m =
        byBusiness.get(r.businessId) ?? new Map<string, BusinessAgent>();
      m.set(r.agentKey, r);
      byBusiness.set(r.businessId, m);
    }
    // Each business's capabilities depend on its own plan.
    const capsById = new Map<string, Set<PlanCapability>>(
      await Promise.all(
        ids.map(
          async (id) =>
            [id, await this.billing.getCapabilities(id)] as const,
        ),
      ),
    );
    return AGENT_CATALOG.filter((a) =>
      ids.some((id) =>
        this.effectiveEnabled(
          a.key,
          byBusiness.get(id)?.get(a.key),
          capsById.get(id) ?? new Set(),
        ),
      ),
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

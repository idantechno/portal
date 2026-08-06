import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessTemplate } from './business-template.entity';
import {
  TEMPLATE_CATALOG,
  TemplateDefinition,
  getTemplate,
} from './template-catalog';

export interface TemplateAccessView extends TemplateDefinition {
  /** Effective access now (row override if present, else catalog default). */
  enabled: boolean;
  /** True when an explicit `business_templates` row exists (manual override). */
  overridden: boolean;
  /** What the catalog alone grants, ignoring any override. */
  catalogDefault: boolean;
}

export interface TemplateListView extends TemplateDefinition {
  entitled: boolean;
}

/**
 * Per-business template entitlements — a slimmer twin of AgentsService. There
 * is no plan layer: a template is on iff an explicit row says so, otherwise it
 * follows the catalog's `defaultEnabled` (base on, special off).
 */
@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(BusinessTemplate)
    private readonly templates: Repository<BusinessTemplate>,
  ) {}

  catalog(): readonly TemplateDefinition[] {
    return TEMPLATE_CATALOG;
  }

  private effectiveEnabled(
    name: string,
    row: BusinessTemplate | undefined,
  ): boolean {
    if (row) return row.enabled;
    return getTemplate(name)?.defaultEnabled ?? false;
  }

  private async rowsByName(
    businessId: string,
  ): Promise<Map<string, BusinessTemplate>> {
    const rows = await this.templates.find({ where: { businessId } });
    return new Map(rows.map((r) => [r.templateName, r]));
  }

  /** Whether this business may send the named template (gates the send path). */
  async hasAccess(businessId: string, templateName: string): Promise<boolean> {
    const row = await this.templates.findOne({
      where: { businessId, templateName },
    });
    return this.effectiveEnabled(templateName, row ?? undefined);
  }

  /** Admin view — catalog + effective state + source (override vs default). */
  async accessForBusiness(businessId: string): Promise<TemplateAccessView[]> {
    const byName = await this.rowsByName(businessId);
    return TEMPLATE_CATALOG.map((t) => {
      const row = byName.get(t.name);
      return {
        ...t,
        enabled: this.effectiveEnabled(t.name, row),
        overridden: row !== undefined,
        catalogDefault: t.defaultEnabled,
      };
    });
  }

  /** Business view — full catalog, each flagged `entitled`. */
  async listForBusiness(businessId: string): Promise<TemplateListView[]> {
    const byName = await this.rowsByName(businessId);
    return TEMPLATE_CATALOG.map((t) => ({
      ...t,
      entitled: this.effectiveEnabled(t.name, byName.get(t.name)),
    }));
  }

  async setAccess(
    businessId: string,
    templateName: string,
    enabled: boolean,
    grantedByUserId: string | null,
  ): Promise<BusinessTemplate> {
    let row = await this.templates.findOne({
      where: { businessId, templateName },
    });
    if (row) {
      row.enabled = enabled;
      row.grantedByUserId = grantedByUserId;
    } else {
      row = this.templates.create({
        businessId,
        templateName,
        enabled,
        grantedByUserId,
      });
    }
    return this.templates.save(row);
  }

  /** Drop the override so the template follows the catalog default again. */
  async resetAccess(
    businessId: string,
    templateName: string,
  ): Promise<boolean> {
    const res = await this.templates.delete({ businessId, templateName });
    return (res.affected ?? 0) > 0;
  }
}

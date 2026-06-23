import * as crypto from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryMode } from '../common/enums/delivery-mode.enum';
import { DocumentStatus } from '../common/enums/document-status.enum';
import { BusinessTemplateConfig } from './business-template-config.entity';
import { DocumentInstance } from './document-instance.entity';
import { DocumentTemplate } from './document-template.entity';
import { BrandConfig, TemplateSnapshot } from './documents.types';

export interface CreateInstanceInput {
  businessId: string;
  templateKey: string;
  variables: Record<string, unknown>;
}

export interface AvailableTemplateRow {
  template: DocumentTemplate;
  config: BusinessTemplateConfig;
}

export interface UpsertBusinessConfigInput {
  brand?: BrandConfig;
  boilerplate?: Record<string, string>;
  isEnabled?: boolean;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentTemplate)
    private readonly templates: Repository<DocumentTemplate>,
    @InjectRepository(BusinessTemplateConfig)
    private readonly configs: Repository<BusinessTemplateConfig>,
    @InjectRepository(DocumentInstance)
    private readonly instances: Repository<DocumentInstance>,
  ) {}

  /**
   * Lists every global template alongside this business's per-template
   * config. If the business has no config row for a template yet, a default
   * (unsaved) one is returned in its place so the UI can still render it.
   */
  async listAvailableTemplates(
    businessId: string,
  ): Promise<AvailableTemplateRow[]> {
    const templates = await this.templates.find({ order: { nameHe: 'ASC' } });
    if (templates.length === 0) return [];

    const configs = await this.configs.find({ where: { businessId } });
    const byTemplateId = new Map(configs.map((c) => [c.templateId, c]));

    return templates
      .map((template) => {
        const config =
          byTemplateId.get(template.id) ??
          defaultConfig(businessId, template.id);
        return { template, config };
      })
      .filter((row) => row.config.isEnabled);
  }

  listInstances(businessId: string): Promise<DocumentInstance[]> {
    return this.instances.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async findInstanceByIdScoped(
    businessId: string,
    id: string,
  ): Promise<DocumentInstance> {
    const instance = await this.instances.findOne({
      where: { id, businessId },
    });
    if (!instance) {
      throw new NotFoundException(`Document instance ${id} not found`);
    }
    return instance;
  }

  findInstanceByPublicToken(token: string): Promise<DocumentInstance | null> {
    return this.instances.findOne({ where: { publicToken: token } });
  }

  saveInstance(instance: DocumentInstance): Promise<DocumentInstance> {
    return this.instances.save(instance);
  }

  async cancelInstance(
    businessId: string,
    id: string,
  ): Promise<DocumentInstance> {
    const instance = await this.findInstanceByIdScoped(businessId, id);
    if (
      instance.status === DocumentStatus.Signed ||
      instance.status === DocumentStatus.Cancelled
    ) {
      return instance;
    }
    instance.status = DocumentStatus.Cancelled;
    return this.instances.save(instance);
  }

  async getBusinessConfig(
    businessId: string,
    templateId: string,
  ): Promise<BusinessTemplateConfig> {
    const existing = await this.configs.findOne({
      where: { businessId, templateId },
    });
    return existing ?? defaultConfig(businessId, templateId);
  }

  async upsertBusinessConfig(
    businessId: string,
    templateId: string,
    input: UpsertBusinessConfigInput,
  ): Promise<BusinessTemplateConfig> {
    const template = await this.templates.findOne({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    const existing = await this.configs.findOne({
      where: { businessId, templateId },
    });
    const target = existing ?? defaultConfig(businessId, templateId);

    if (input.brand !== undefined) target.brand = input.brand;
    if (input.boilerplate !== undefined) target.boilerplate = input.boilerplate;
    if (input.isEnabled !== undefined) target.isEnabled = input.isEnabled;

    return this.configs.save(target);
  }

  async createInstance(input: CreateInstanceInput): Promise<DocumentInstance> {
    const template = await this.templates.findOne({
      where: { key: input.templateKey },
    });
    if (!template) {
      throw new NotFoundException(`Template "${input.templateKey}" not found`);
    }

    const config = await this.getBusinessConfig(input.businessId, template.id);

    const snapshot: TemplateSnapshot = {
      htmlTemplate: template.htmlTemplate,
      templateVersion: template.version,
      config: {
        boilerplate: config.boilerplate,
        brand: config.brand,
      },
    };

    const publicToken =
      template.deliveryMode === DeliveryMode.ClientSign
        ? generatePublicToken()
        : null;

    return this.instances.save(
      this.instances.create({
        businessId: input.businessId,
        templateId: template.id,
        templateSnapshot: snapshot,
        variables: input.variables,
        status: DocumentStatus.Draft,
        publicToken,
      }),
    );
  }
}

function defaultConfig(
  businessId: string,
  templateId: string,
): BusinessTemplateConfig {
  const config = new BusinessTemplateConfig();
  config.businessId = businessId;
  config.templateId = templateId;
  config.boilerplate = {};
  config.brand = {};
  config.isEnabled = true;
  return config;
}

function generatePublicToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

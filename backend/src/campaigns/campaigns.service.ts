import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomersService } from '../customers/customers.service';
import { PlansService } from '../plans/plans.service';
import { Campaign, CampaignStatus } from './campaign.entity';
import { CampaignPrerequisitesService } from './campaign-prerequisites.service';

export interface CreateCampaignInput {
  businessId: string;
  customerId: string;
  name: string;
}

export interface UpdateCampaignInput {
  name?: string;
  status?: CampaignStatus;
}

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaigns: Repository<Campaign>,
    private readonly customers: CustomersService,
    private readonly plans: PlansService,
    private readonly prerequisites: CampaignPrerequisitesService,
  ) {}

  /**
   * Create a campaign — hard-gated on every prerequisite being met. Throws 400
   * listing what's missing otherwise. Stage A (marketing plan) is wired to the
   * customer's approved plan at creation.
   */
  async create(input: CreateCampaignInput): Promise<Campaign> {
    // Validates the customer belongs to the business (throws 404 otherwise).
    await this.customers.findByIdScoped(input.businessId, input.customerId);

    const report = await this.prerequisites.report(
      input.businessId,
      input.customerId,
    );
    if (!report.allMet) {
      const missing = report.items
        .filter((i) => !i.met)
        .map((i) => i.label)
        .join(', ');
      throw new BadRequestException(
        `לא ניתן ליצור קמפיין — חסרות דרישות קדם: ${missing}`,
      );
    }

    const approvedPlan = (
      await this.plans.list(input.businessId, input.customerId)
    ).find((p) => p.status === 'approved');

    return this.campaigns.save(
      this.campaigns.create({
        businessId: input.businessId,
        customerId: input.customerId,
        name: input.name.trim().slice(0, 255),
        status: 'building',
        marketingPlanId: approvedPlan?.id ?? null,
      }),
    );
  }

  list(businessId: string, customerId?: string): Promise<Campaign[]> {
    return this.campaigns.find({
      where: { businessId, ...(customerId ? { customerId } : {}) },
      order: { updatedAt: 'DESC' },
    });
  }

  async findByIdScoped(businessId: string, id: string): Promise<Campaign> {
    const campaign = await this.campaigns.findOne({
      where: { id, businessId },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async update(
    businessId: string,
    id: string,
    input: UpdateCampaignInput,
  ): Promise<Campaign> {
    const campaign = await this.findByIdScoped(businessId, id);
    if (input.name !== undefined)
      campaign.name = input.name.trim().slice(0, 255);
    if (input.status !== undefined) {
      campaign.status = input.status;
      if (input.status === 'active' && !campaign.launchedAt) {
        campaign.launchedAt = new Date();
      }
    }
    return this.campaigns.save(campaign);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const campaign = await this.findByIdScoped(businessId, id);
    await this.campaigns.remove(campaign);
  }
}

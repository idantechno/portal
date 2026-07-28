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
   * Create a campaign. Stage A is the marketing plan, so creation requires the
   * customer to have an approved plan — it's wired as the campaign's stage A.
   * The FULL prerequisite list (brand page, logo, quote, goals, …) is enforced
   * later, at activation (stage C), not here.
   */
  async create(input: CreateCampaignInput): Promise<Campaign> {
    // Validates the customer belongs to the business (throws 404 otherwise).
    await this.customers.findByIdScoped(input.businessId, input.customerId);

    const approvedPlan = (
      await this.plans.list(input.businessId, input.customerId)
    ).find((p) => p.status === 'approved');
    if (!approvedPlan) {
      throw new BadRequestException(
        'כדי לפתוח קמפיין צריך קודם תוכנית מאושרת ללקוח (שלב א׳).',
      );
    }

    return this.campaigns.save(
      this.campaigns.create({
        businessId: input.businessId,
        customerId: input.customerId,
        name: input.name.trim().slice(0, 255),
        status: 'building',
        marketingPlanId: approvedPlan.id,
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
      // Activating (stage C) is the hard gate: every prerequisite must be met.
      if (input.status === 'active' && campaign.status !== 'active') {
        const report = await this.prerequisites.report(
          businessId,
          campaign.customerId,
        );
        if (!report.allMet) {
          const missing = report.items
            .filter((i) => !i.met)
            .map((i) => i.label)
            .join(', ');
          throw new BadRequestException(
            `לא ניתן להפעיל קמפיין — חסרות דרישות קדם: ${missing}`,
          );
        }
      }
      campaign.status = input.status;
      if (input.status === 'active' && !campaign.launchedAt) {
        campaign.launchedAt = new Date();
      }
    }
    return this.campaigns.save(campaign);
  }

  /** Stage B: save the owner's answers to the 3 creative questions. */
  async saveProductionAnswers(
    businessId: string,
    id: string,
    answers: { style?: string; firstScene?: string; clientPresence?: string },
  ): Promise<Campaign> {
    const campaign = await this.findByIdScoped(businessId, id);
    const prev = campaign.productionAnswers ?? {
      style: '',
      firstScene: '',
      clientPresence: '',
    };
    campaign.productionAnswers = {
      style: (answers.style ?? prev.style ?? '').trim(),
      firstScene: (answers.firstScene ?? prev.firstScene ?? '').trim(),
      clientPresence: (
        answers.clientPresence ??
        prev.clientPresence ??
        ''
      ).trim(),
    };
    return this.campaigns.save(campaign);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const campaign = await this.findByIdScoped(businessId, id);
    await this.campaigns.remove(campaign);
  }
}

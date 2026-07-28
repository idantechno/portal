import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { StrategiesService } from '../strategies/strategies.service';
import { Plan } from './plan.entity';
import { PlansService } from './plans.service';
import { EMPTY_PLAN, PlanDrafterService } from './plan-drafter.service';
import { renderPlan } from './plan-renderer';

export interface GeneratePlanInput {
  businessId: string;
  strategyId: string;
  /** Skip the model entirely — an empty ⟨לא ידוע⟩ shell. Useful without a key. */
  skipDrafting?: boolean;
}

/**
 * Turns an approved strategy into an execution plan.
 *
 * The approval gate is the whole point: a plan can only be built once the
 * operator has signed off on the strategy. The strategy markdown is the sole
 * input. On any drafting failure we render the empty shell so the plan ships
 * with ⟨לא ידוע⟩ instead of invented tasks.
 */
@Injectable()
export class PlanGeneratorService {
  private readonly log = new Logger(PlanGeneratorService.name);

  constructor(
    private readonly strategies: StrategiesService,
    private readonly plans: PlansService,
    private readonly drafter: PlanDrafterService,
    private readonly claude: ClaudeJsonService,
  ) {}

  async generate(input: GeneratePlanInput): Promise<Plan> {
    const strategy = await this.strategies.findByIdScoped(
      input.businessId,
      input.strategyId,
    );
    if (!strategy) {
      throw new NotFoundException(`Strategy ${input.strategyId} not found`);
    }
    if (strategy.status !== 'approved') {
      throw new BadRequestException('יש לאשר את האסטרטגיה לפני הפקת תוכנית');
    }

    const draft =
      input.skipDrafting || !this.claude.configured
        ? { ...EMPTY_PLAN }
        : await this.drafter.draft({ strategyMarkdown: strategy.markdown });

    const generatedAt = new Date();
    const markdown = renderPlan({
      draft,
      businessName: strategy.title,
      generatedAt,
      model: this.claude.model,
    });

    this.log.log(
      `plan generated business=${input.businessId} strategy=${input.strategyId} ` +
        `workstreams=${draft.workstreams.length} milestones=${draft.milestones.length}`,
    );

    return this.plans.create({
      businessId: input.businessId,
      strategyId: strategy.id,
      // Inherit the customer from the source strategy so the plan lands under
      // the same customer automatically.
      customerId: strategy.customerId,
      title: strategy.title,
      markdown,
      model: this.claude.model,
      payload: {
        draft,
        strategyId: strategy.id,
        generatedAt: generatedAt.toISOString(),
      },
    });
  }
}

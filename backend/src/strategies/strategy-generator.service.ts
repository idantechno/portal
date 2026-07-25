import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BriefsService } from '../briefs/briefs.service';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { Strategy } from './strategy.entity';
import { StrategiesService } from './strategies.service';
import {
  EMPTY_STRATEGY,
  StrategyDrafterService,
} from './strategy-drafter.service';
import { renderStrategy } from './strategy-renderer';

export interface GenerateStrategyInput {
  businessId: string;
  briefId: string;
  /** Skip the model entirely — an empty ⟨לא ידוע⟩ shell. Useful without a key. */
  skipDrafting?: boolean;
}

/**
 * Turns an approved brief into a marketing strategy.
 *
 * The approval gate is the whole point: a strategy can only be built once the
 * operator has signed off on the brief (the facts). The brief markdown — which
 * already carries every resolved layer — is the sole input. On any drafting
 * failure we render the empty shell so the strategy ships with ⟨לא ידוע⟩
 * instead of invented content.
 */
@Injectable()
export class StrategyGeneratorService {
  private readonly log = new Logger(StrategyGeneratorService.name);

  constructor(
    private readonly briefs: BriefsService,
    private readonly strategies: StrategiesService,
    private readonly drafter: StrategyDrafterService,
    private readonly claude: ClaudeJsonService,
  ) {}

  async generate(input: GenerateStrategyInput): Promise<Strategy> {
    const brief = await this.briefs.findByIdScoped(
      input.businessId,
      input.briefId,
    );
    if (!brief) throw new NotFoundException(`Brief ${input.briefId} not found`);
    if (brief.status !== 'approved') {
      throw new BadRequestException('יש לאשר את הבריף לפני הפקת אסטרטגיה');
    }

    const draft =
      input.skipDrafting || !this.claude.configured
        ? { ...EMPTY_STRATEGY }
        : await this.drafter.draft({ briefMarkdown: brief.markdown });

    const generatedAt = new Date();
    const markdown = renderStrategy({
      draft,
      businessName: brief.title,
      generatedAt,
      model: this.claude.model,
    });

    this.log.log(
      `strategy generated business=${input.businessId} brief=${input.briefId} ` +
        `proofBlocker=${draft.proofIsBlocker} audiences=${draft.audiences.length} ` +
        `roadmap=${draft.roadmap.length}`,
    );

    return this.strategies.create({
      businessId: input.businessId,
      briefId: brief.id,
      title: brief.title,
      markdown,
      model: this.claude.model,
      payload: {
        draft,
        briefId: brief.id,
        generatedAt: generatedAt.toISOString(),
      },
    });
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BriefsService } from '../briefs/briefs.service';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { Objective } from './objective.entity';
import { ObjectivesService } from './objectives.service';
import {
  EMPTY_OBJECTIVE,
  ObjectiveDrafterService,
} from './objective-drafter.service';
import { renderObjective } from './objective-renderer';

export interface GenerateObjectiveInput {
  businessId: string;
  customerId: string;
  /** Skip the model entirely — an empty ⟨לא ידוע⟩ shell. */
  skipDrafting?: boolean;
}

/**
 * Builds a goals-&-objectives doc for a customer from that customer's approved
 * brief. Requires an approved brief (the source of truth); on any drafting
 * failure renders the empty shell so the doc ships with ⟨לא ידוע⟩ rather than
 * invented goals.
 */
@Injectable()
export class ObjectiveGeneratorService {
  private readonly log = new Logger(ObjectiveGeneratorService.name);

  constructor(
    private readonly briefs: BriefsService,
    private readonly objectives: ObjectivesService,
    private readonly drafter: ObjectiveDrafterService,
    private readonly claude: ClaudeJsonService,
  ) {}

  async generate(input: GenerateObjectiveInput): Promise<Objective> {
    const brief = (
      await this.briefs.list(input.businessId, input.customerId)
    ).find((b) => b.status === 'approved');
    if (!brief) {
      throw new BadRequestException(
        'צריך בריף מאושר ללקוח כדי להפיק יעדים ומטרות.',
      );
    }
    // list() omits markdown — fetch the full brief for the drafter.
    const full = await this.briefs.findByIdScoped(input.businessId, brief.id);
    if (!full) throw new NotFoundException('Brief not found');

    const draft =
      input.skipDrafting || !this.claude.configured
        ? { ...EMPTY_OBJECTIVE }
        : await this.drafter.draft({ briefMarkdown: full.markdown });

    const generatedAt = new Date();
    const markdown = renderObjective({
      draft,
      businessName: full.title,
      generatedAt,
      model: this.claude.model,
    });

    this.log.log(
      `objective generated business=${input.businessId} customer=${input.customerId} ` +
        `goals=${draft.goals.length} metrics=${draft.metrics.length}`,
    );

    return this.objectives.create({
      businessId: input.businessId,
      customerId: input.customerId,
      briefId: full.id,
      title: full.title,
      markdown,
      model: this.claude.model,
      payload: {
        draft,
        briefId: full.id,
        generatedAt: generatedAt.toISOString(),
      },
    });
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilesystemService } from '../context-files/filesystem.service';
import { Strategy, StrategyStatus } from './strategy.entity';
import { StrategyDraft } from './strategy-drafter.service';
import { renderClientStrategy } from './client-strategy-renderer';

export interface CreateStrategyInput {
  businessId: string;
  briefId: string | null;
  title: string;
  markdown: string;
  model?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface UpdateStrategyInput {
  markdown?: string;
  status?: StrategyStatus;
  title?: string;
}

/**
 * CRUD for strategies, scoped by businessId. Every write is mirrored (best
 * effort) to `strategies/<id>.md` under the business root, so the other agents
 * — whose cwd is that root — can read the strategy as business context. The DB
 * row stays the source of truth for the UI.
 */
@Injectable()
export class StrategiesService {
  private readonly log = new Logger(StrategiesService.name);

  constructor(
    @InjectRepository(Strategy)
    private readonly strategies: Repository<Strategy>,
    private readonly filesystem: FilesystemService,
  ) {}

  list(businessId: string): Promise<Strategy[]> {
    return this.strategies.find({
      where: { businessId },
      order: { updatedAt: 'DESC' },
      select: {
        id: true,
        businessId: true,
        briefId: true,
        title: true,
        status: true,
        model: true,
        edited: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByIdScoped(businessId: string, id: string): Promise<Strategy> {
    const strategy = await this.strategies.findOne({
      where: { id, businessId },
    });
    if (!strategy) throw new NotFoundException(`Strategy ${id} not found`);
    return strategy;
  }

  /**
   * The client-facing version of the strategy: the same plan rendered clean of
   * the agency's internal notes. Built from the stored structured draft; if a
   * strategy predates the draft-payload it falls back to the stored markdown.
   */
  async clientMarkdown(businessId: string, id: string): Promise<string> {
    const strategy = await this.findByIdScoped(businessId, id);
    // The generator stores { draft, briefId, generatedAt } — the StrategyDraft
    // lives under `.draft`. Without a draft (older rows) fall back to markdown.
    const payload = strategy.payload as {
      draft?: StrategyDraft;
      generatedAt?: string;
    } | null;
    if (!payload?.draft) return strategy.markdown;
    const generatedAt = payload.generatedAt
      ? new Date(payload.generatedAt)
      : strategy.updatedAt;
    return renderClientStrategy(
      payload.draft,
      this.businessNameFrom(strategy.markdown),
      generatedAt,
    );
  }

  /** The strategy H1 is always `# אסטרטגיית שיווק — <name>` (see the renderer). */
  private businessNameFrom(markdown: string): string {
    const first = (markdown.split('\n')[0] ?? '').trim();
    const m = first.match(/^#\s*אסטרטגיית שיווק\s*—\s*(.+)$/);
    return m ? m[1].trim() : 'העסק';
  }

  async create(input: CreateStrategyInput): Promise<Strategy> {
    const strategy = this.strategies.create({
      businessId: input.businessId,
      briefId: input.briefId,
      title: input.title.trim().slice(0, 255),
      markdown: input.markdown,
      status: 'draft',
      model: input.model ?? null,
      payload: input.payload ?? null,
      edited: false,
    });
    const saved = await this.strategies.save(strategy);
    await this.mirror(saved);
    return saved;
  }

  async update(
    businessId: string,
    id: string,
    patch: UpdateStrategyInput,
  ): Promise<Strategy> {
    const strategy = await this.findByIdScoped(businessId, id);
    if (patch.markdown !== undefined && patch.markdown !== strategy.markdown) {
      strategy.markdown = patch.markdown;
      strategy.edited = true;
    }
    if (patch.status !== undefined) strategy.status = patch.status;
    if (patch.title !== undefined)
      strategy.title = patch.title.trim().slice(0, 255);
    const saved = await this.strategies.save(strategy);
    await this.mirror(saved);
    return saved;
  }

  async remove(businessId: string, id: string): Promise<void> {
    const strategy = await this.findByIdScoped(businessId, id);
    await this.strategies.remove(strategy);
    await this.filesystem
      .deleteFile(businessId, this.artifactPath(id))
      .catch((err) =>
        this.log.warn(
          `Failed to delete strategy artifact: ${(err as Error).message}`,
        ),
      );
  }

  private artifactPath(id: string): string {
    return `strategies/${id}.md`;
  }

  /** Writes the markdown mirror; never throws — the DB row is authoritative. */
  private async mirror(strategy: Strategy): Promise<void> {
    try {
      await this.filesystem.ensureBusinessRoot(strategy.businessId);
      await this.filesystem.writeFile(
        strategy.businessId,
        this.artifactPath(strategy.id),
        Buffer.from(strategy.markdown, 'utf8'),
      );
    } catch (err) {
      this.log.warn(
        `Failed to mirror strategy artifact: ${(err as Error).message}`,
      );
    }
  }
}

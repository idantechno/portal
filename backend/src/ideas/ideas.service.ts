import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdeaStatus } from '../common/enums/idea-status.enum';
import { FilesystemService } from '../context-files/filesystem.service';
import { Idea } from './idea.entity';

export interface CreateIdeaInput {
  businessId: string;
  title: string;
  summary?: string | null;
  body?: string;
  status?: IdeaStatus;
}

export interface UpdateIdeaInput {
  title?: string;
  summary?: string | null;
  body?: string;
  status?: IdeaStatus;
}

/**
 * CRUD for ideas, scoped by businessId. Every write is mirrored (best-effort)
 * to `ideas/<id>.md` under the business root so the file becomes shared
 * business context readable by the other agents (their cwd is the business
 * root). The DB stays the source of truth for the UI.
 */
@Injectable()
export class IdeasService {
  private readonly log = new Logger(IdeasService.name);

  constructor(
    @InjectRepository(Idea)
    private readonly ideas: Repository<Idea>,
    private readonly filesystem: FilesystemService,
  ) {}

  list(businessId: string): Promise<Idea[]> {
    return this.ideas.find({
      where: { businessId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findByIdScoped(businessId: string, id: string): Promise<Idea> {
    const idea = await this.ideas.findOne({ where: { id, businessId } });
    if (!idea) throw new NotFoundException(`Idea ${id} not found`);
    return idea;
  }

  async create(input: CreateIdeaInput): Promise<Idea> {
    const idea = this.ideas.create({
      businessId: input.businessId,
      title: input.title.trim().slice(0, 255),
      summary: input.summary?.trim() || null,
      body: input.body ?? '',
      status: input.status ?? IdeaStatus.Seed,
    });
    const saved = await this.ideas.save(idea);
    await this.mirror(saved);
    return saved;
  }

  async update(
    businessId: string,
    id: string,
    patch: UpdateIdeaInput,
  ): Promise<Idea> {
    const idea = await this.findByIdScoped(businessId, id);
    if (patch.title !== undefined)
      idea.title = patch.title.trim().slice(0, 255);
    if (patch.summary !== undefined)
      idea.summary = patch.summary?.trim() || null;
    if (patch.body !== undefined) idea.body = patch.body;
    if (patch.status !== undefined) idea.status = patch.status;
    const saved = await this.ideas.save(idea);
    await this.mirror(saved);
    return saved;
  }

  async remove(businessId: string, id: string): Promise<void> {
    const idea = await this.findByIdScoped(businessId, id);
    await this.ideas.remove(idea);
    await this.filesystem
      .deleteFile(businessId, this.artifactPath(id))
      .catch((err) =>
        this.log.warn(
          `Failed to delete idea artifact: ${(err as Error).message}`,
        ),
      );
  }

  private artifactPath(id: string): string {
    return `ideas/${id}.md`;
  }

  /** Writes the markdown mirror; never throws — the DB row is authoritative. */
  private async mirror(idea: Idea): Promise<void> {
    const lines = [
      `# ${idea.title}`,
      '',
      `סטטוס: ${idea.status}`,
      `עודכן: ${idea.updatedAt.toISOString()}`,
      '',
    ];
    if (idea.summary) {
      lines.push('## תמצית', idea.summary, '');
    }
    if (idea.body) {
      lines.push('## פיתוח', idea.body, '');
    }
    try {
      await this.filesystem.ensureBusinessRoot(idea.businessId);
      await this.filesystem.writeFile(
        idea.businessId,
        this.artifactPath(idea.id),
        Buffer.from(lines.join('\n'), 'utf8'),
      );
    } catch (err) {
      this.log.warn(
        `Failed to mirror idea artifact: ${(err as Error).message}`,
      );
    }
  }
}

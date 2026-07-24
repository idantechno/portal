import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilesystemService } from '../context-files/filesystem.service';
import { Brief, BriefStatus } from './brief.entity';

export interface CreateBriefInput {
  businessId: string;
  leadId: string | null;
  title: string;
  markdown: string;
  websiteUrl?: string | null;
  model?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface UpdateBriefInput {
  markdown?: string;
  status?: BriefStatus;
  title?: string;
}

/**
 * CRUD for briefs, scoped by businessId. Every write is mirrored (best effort)
 * to `briefs/<id>.md` under the business root, so the other agents — whose cwd
 * is that root — can read the brief as business context. The DB row stays the
 * source of truth for the UI.
 */
@Injectable()
export class BriefsService {
  private readonly log = new Logger(BriefsService.name);

  constructor(
    @InjectRepository(Brief)
    private readonly briefs: Repository<Brief>,
    private readonly filesystem: FilesystemService,
  ) {}

  list(businessId: string): Promise<Brief[]> {
    return this.briefs.find({
      where: { businessId },
      order: { updatedAt: 'DESC' },
      select: {
        id: true,
        businessId: true,
        leadId: true,
        title: true,
        status: true,
        websiteUrl: true,
        model: true,
        edited: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByIdScoped(businessId: string, id: string): Promise<Brief> {
    const brief = await this.briefs.findOne({ where: { id, businessId } });
    if (!brief) throw new NotFoundException(`Brief ${id} not found`);
    return brief;
  }

  findLatestForLead(businessId: string, leadId: string): Promise<Brief | null> {
    return this.briefs.findOne({
      where: { businessId, leadId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(input: CreateBriefInput): Promise<Brief> {
    const brief = this.briefs.create({
      businessId: input.businessId,
      leadId: input.leadId,
      title: input.title.trim().slice(0, 255),
      markdown: input.markdown,
      status: 'draft',
      websiteUrl: input.websiteUrl?.trim().slice(0, 512) || null,
      model: input.model ?? null,
      payload: input.payload ?? null,
      edited: false,
    });
    const saved = await this.briefs.save(brief);
    await this.mirror(saved);
    return saved;
  }

  async update(
    businessId: string,
    id: string,
    patch: UpdateBriefInput,
  ): Promise<Brief> {
    const brief = await this.findByIdScoped(businessId, id);
    if (patch.markdown !== undefined && patch.markdown !== brief.markdown) {
      brief.markdown = patch.markdown;
      brief.edited = true;
    }
    if (patch.status !== undefined) brief.status = patch.status;
    if (patch.title !== undefined)
      brief.title = patch.title.trim().slice(0, 255);
    const saved = await this.briefs.save(brief);
    await this.mirror(saved);
    return saved;
  }

  async remove(businessId: string, id: string): Promise<void> {
    const brief = await this.findByIdScoped(businessId, id);
    await this.briefs.remove(brief);
    await this.filesystem
      .deleteFile(businessId, this.artifactPath(id))
      .catch((err) =>
        this.log.warn(
          `Failed to delete brief artifact: ${(err as Error).message}`,
        ),
      );
  }

  private artifactPath(id: string): string {
    return `briefs/${id}.md`;
  }

  /** Writes the markdown mirror; never throws — the DB row is authoritative. */
  private async mirror(brief: Brief): Promise<void> {
    try {
      await this.filesystem.ensureBusinessRoot(brief.businessId);
      await this.filesystem.writeFile(
        brief.businessId,
        this.artifactPath(brief.id),
        Buffer.from(brief.markdown, 'utf8'),
      );
    } catch (err) {
      this.log.warn(
        `Failed to mirror brief artifact: ${(err as Error).message}`,
      );
    }
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilesystemService } from '../context-files/filesystem.service';
import { Objective, ObjectiveStatus } from './objective.entity';

export interface CreateObjectiveInput {
  businessId: string;
  customerId: string | null;
  briefId: string | null;
  title: string;
  markdown: string;
  model?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface UpdateObjectiveInput {
  markdown?: string;
  status?: ObjectiveStatus;
  title?: string;
}

/**
 * CRUD for goals-&-objectives docs, scoped by businessId. Mirrors each write to
 * `objectives/<id>.md` under the business root so other agents can read it as
 * context. The DB row is the source of truth.
 */
@Injectable()
export class ObjectivesService {
  private readonly log = new Logger(ObjectivesService.name);

  constructor(
    @InjectRepository(Objective)
    private readonly objectives: Repository<Objective>,
    private readonly filesystem: FilesystemService,
  ) {}

  list(businessId: string, customerId?: string): Promise<Objective[]> {
    return this.objectives.find({
      where: { businessId, ...(customerId ? { customerId } : {}) },
      order: { updatedAt: 'DESC' },
      select: {
        id: true,
        businessId: true,
        customerId: true,
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

  /** Does the customer have an approved objectives doc? — the campaign gate. */
  async hasApproved(businessId: string, customerId: string): Promise<boolean> {
    const count = await this.objectives.count({
      where: { businessId, customerId, status: 'approved' },
    });
    return count > 0;
  }

  async findByIdScoped(businessId: string, id: string): Promise<Objective> {
    const objective = await this.objectives.findOne({
      where: { id, businessId },
    });
    if (!objective) throw new NotFoundException(`Objective ${id} not found`);
    return objective;
  }

  async create(input: CreateObjectiveInput): Promise<Objective> {
    const objective = this.objectives.create({
      businessId: input.businessId,
      customerId: input.customerId,
      briefId: input.briefId,
      title: input.title.trim().slice(0, 255),
      markdown: input.markdown,
      status: 'draft',
      model: input.model ?? null,
      payload: input.payload ?? null,
      edited: false,
    });
    const saved = await this.objectives.save(objective);
    await this.mirror(saved);
    return saved;
  }

  async update(
    businessId: string,
    id: string,
    patch: UpdateObjectiveInput,
  ): Promise<Objective> {
    const objective = await this.findByIdScoped(businessId, id);
    if (patch.markdown !== undefined && patch.markdown !== objective.markdown) {
      objective.markdown = patch.markdown;
      objective.edited = true;
    }
    if (patch.status !== undefined) objective.status = patch.status;
    if (patch.title !== undefined)
      objective.title = patch.title.trim().slice(0, 255);
    const saved = await this.objectives.save(objective);
    await this.mirror(saved);
    return saved;
  }

  async remove(businessId: string, id: string): Promise<void> {
    const objective = await this.findByIdScoped(businessId, id);
    await this.objectives.remove(objective);
    await this.filesystem
      .deleteFile(businessId, this.artifactPath(id))
      .catch((err) =>
        this.log.warn(
          `Failed to delete objective artifact: ${(err as Error).message}`,
        ),
      );
  }

  private artifactPath(id: string): string {
    return `objectives/${id}.md`;
  }

  private async mirror(objective: Objective): Promise<void> {
    try {
      await this.filesystem.ensureBusinessRoot(objective.businessId);
      await this.filesystem.writeFile(
        objective.businessId,
        this.artifactPath(objective.id),
        Buffer.from(objective.markdown, 'utf8'),
      );
    } catch (err) {
      this.log.warn(
        `Failed to mirror objective artifact: ${(err as Error).message}`,
      );
    }
  }
}

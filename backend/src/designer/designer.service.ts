import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { FilesystemService } from '../context-files/filesystem.service';
import { PdfRendererService } from '../documents/pdf-renderer.service';
import { DesignKind, DesignProduct } from './design-product.entity';

/** How many design generations a business gets per calendar month. */
export const DESIGN_MONTHLY_LIMIT = 30;

export interface CreateDesignInput {
  businessId: string;
  kind: DesignKind;
  title: string;
  html: string;
  contentSummary?: string | null;
  primaryColor?: string | null;
}

@Injectable()
export class DesignerService {
  private readonly log = new Logger(DesignerService.name);

  constructor(
    @InjectRepository(DesignProduct)
    private readonly designs: Repository<DesignProduct>,
    private readonly filesystem: FilesystemService,
    private readonly renderer: PdfRendererService,
  ) {}

  list(businessId: string): Promise<DesignProduct[]> {
    return this.designs.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdScoped(businessId: string, id: string): Promise<DesignProduct> {
    const row = await this.designs.findOne({ where: { id, businessId } });
    if (!row) throw new NotFoundException(`Design ${id} not found`);
    return row;
  }

  private monthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  countThisMonth(businessId: string): Promise<number> {
    return this.designs.count({
      where: { businessId, createdAt: MoreThanOrEqual(this.monthStart()) },
    });
  }

  async remainingThisMonth(businessId: string): Promise<number> {
    const used = await this.countThisMonth(businessId);
    return Math.max(0, DESIGN_MONTHLY_LIMIT - used);
  }

  async create(input: CreateDesignInput): Promise<DesignProduct> {
    const row = await this.designs.save(
      this.designs.create({
        businessId: input.businessId,
        kind: input.kind,
        title: input.title.trim().slice(0, 255),
        html: input.html,
        contentSummary: input.contentSummary?.trim() || null,
        primaryColor: input.primaryColor?.trim().slice(0, 16) || null,
      }),
    );
    await this.mirror(row);
    return row;
  }

  async remove(businessId: string, id: string): Promise<void> {
    const row = await this.findByIdScoped(businessId, id);
    await this.designs.remove(row);
    await this.filesystem
      .deleteFile(businessId, this.artifactPath(id))
      .catch((err) =>
        this.log.warn(
          `Failed to delete design artifact: ${(err as Error).message}`,
        ),
      );
  }

  renderPdf(businessId: string, id: string): Promise<Buffer> {
    return this.findByIdScoped(businessId, id).then((row) =>
      this.renderer.renderUntrustedHtmlToPdf(row.html),
    );
  }

  private artifactPath(id: string): string {
    return `designs/${id}.md`;
  }

  /**
   * Mirrors a text note (not the HTML) to the business root so other agents
   * can read what was designed — this is the shared-artifact bus (e.g. a new
   * menu with prices becomes context the reminders/orchestrator agents see).
   */
  private async mirror(design: DesignProduct): Promise<void> {
    const lines = [
      `# ${design.title}`,
      '',
      `סוג: ${design.kind}`,
      `נוצר: ${design.createdAt.toISOString()}`,
      '',
    ];
    if (design.contentSummary) {
      lines.push('## תוכן', design.contentSummary, '');
    }
    try {
      await this.filesystem.ensureBusinessRoot(design.businessId);
      await this.filesystem.writeFile(
        design.businessId,
        this.artifactPath(design.id),
        Buffer.from(lines.join('\n'), 'utf8'),
      );
    } catch (err) {
      this.log.warn(
        `Failed to mirror design artifact: ${(err as Error).message}`,
      );
    }
  }
}

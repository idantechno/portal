import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentTemplate } from './document-template.entity';
import { DOCUMENT_TEMPLATE_SEEDS, DocumentTemplateSeed } from './seeds';

/**
 * On boot, ensures the global DocumentTemplate rows exist and are at the
 * latest version. Upsert is keyed on `key`; bumping `version` in a seed
 * triggers an in-place update (existing DocumentInstance rows are unaffected
 * because they carry a frozen template_snapshot).
 */
@Injectable()
export class DocumentsSeederService implements OnModuleInit {
  private readonly log = new Logger(DocumentsSeederService.name);

  constructor(
    @InjectRepository(DocumentTemplate)
    private readonly templates: Repository<DocumentTemplate>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const seed of DOCUMENT_TEMPLATE_SEEDS) {
      await this.upsert(seed);
    }
  }

  private async upsert(seed: DocumentTemplateSeed): Promise<void> {
    const existing = await this.templates.findOne({ where: { key: seed.key } });
    if (!existing) {
      await this.templates.save(this.templates.create(seed));
      this.log.log(`Seeded template "${seed.key}" v${seed.version}`);
      return;
    }
    if (existing.version < seed.version) {
      const previousVersion = existing.version;
      existing.nameHe = seed.nameHe;
      existing.version = seed.version;
      existing.deliveryMode = seed.deliveryMode;
      existing.variableSchema = seed.variableSchema;
      existing.htmlTemplate = seed.htmlTemplate;
      await this.templates.save(existing);
      this.log.log(
        `Updated template "${seed.key}" v${previousVersion} → v${seed.version}`,
      );
    }
  }
}

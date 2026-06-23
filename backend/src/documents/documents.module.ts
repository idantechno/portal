import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { BusinessTemplateConfig } from './business-template-config.entity';
import { DocumentInstance } from './document-instance.entity';
import { DocumentTemplate } from './document-template.entity';
import { DocumentPdfService } from './document-pdf.service';
import { DocumentsAgentService } from './documents-agent.service';
import { DocumentsController } from './documents.controller';
import { DocumentsPublicController } from './documents-public.controller';
import { DocumentsSeederService } from './documents-seeder.service';
import { DocumentsService } from './documents.service';
import { PdfRendererService } from './pdf-renderer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentTemplate,
      BusinessTemplateConfig,
      DocumentInstance,
    ]),
    BusinessesModule,
    ContextFilesModule,
    AgentsModule,
  ],
  controllers: [DocumentsController, DocumentsPublicController],
  providers: [
    DocumentsService,
    DocumentsSeederService,
    DocumentsAgentService,
    DocumentPdfService,
    PdfRendererService,
  ],
  exports: [DocumentsService, DocumentsAgentService, DocumentPdfService],
})
export class DocumentsModule {}

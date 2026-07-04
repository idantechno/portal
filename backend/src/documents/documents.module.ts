import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AgentsModule } from '../agents/agents.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { FilingModule } from '../filing/filing.module';
import { TasksModule } from '../tasks/tasks.module';
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
import { DOCUMENT_REMINDERS_QUEUE } from './document-reminders.constants';
import { DocumentRemindersService } from './document-reminders.service';
import { DocumentRemindersProcessor } from './document-reminders.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentTemplate,
      BusinessTemplateConfig,
      DocumentInstance,
    ]),
    BullModule.registerQueue({ name: DOCUMENT_REMINDERS_QUEUE }),
    BusinessesModule,
    ContextFilesModule,
    AgentsModule,
    FilingModule,
    TasksModule,
  ],
  controllers: [DocumentsController, DocumentsPublicController],
  providers: [
    DocumentsService,
    DocumentsSeederService,
    DocumentsAgentService,
    DocumentPdfService,
    PdfRendererService,
    DocumentRemindersService,
    DocumentRemindersProcessor,
  ],
  exports: [
    DocumentsService,
    DocumentsAgentService,
    DocumentPdfService,
    PdfRendererService,
  ],
})
export class DocumentsModule {}

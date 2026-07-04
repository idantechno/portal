import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { DocumentsModule } from '../documents/documents.module';
import { DesignProduct } from './design-product.entity';
import { DesignerAgentService } from './designer-agent.service';
import { DesignerController } from './designer.controller';
import { DesignerService } from './designer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DesignProduct]),
    BusinessesModule,
    ContextFilesModule,
    AgentsModule,
    // For the hardened PdfRendererService (exported by DocumentsModule).
    DocumentsModule,
  ],
  controllers: [DesignerController],
  providers: [DesignerService, DesignerAgentService],
  exports: [DesignerService],
})
export class DesignerModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { LeadsModule } from '../leads/leads.module';
import { Brief } from './brief.entity';
import { BriefDrafterService } from './brief-drafter.service';
import { BriefGeneratorService } from './brief-generator.service';
import { BriefsController } from './briefs.controller';
import { BriefsService } from './briefs.service';
import { ClaudeJsonService } from './claude-json.service';
import { WebsiteExtractorService } from './website-extractor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Brief]),
    BusinessesModule,
    ContextFilesModule,
    LeadsModule,
  ],
  controllers: [BriefsController],
  providers: [
    BriefsService,
    BriefGeneratorService,
    BriefDrafterService,
    WebsiteExtractorService,
    ClaudeJsonService,
  ],
  exports: [BriefsService],
})
export class BriefsModule {}

import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { WebsiteExtractorService } from '../briefs/website-extractor.service';
import { WebsiteFactsService } from './website-facts.service';
import { WebsiteFactsController } from './website-facts.controller';

/**
 * "Import facts from the business website." Reuses the briefs' SSRF-guarded
 * crawler + one-shot Claude call (provided directly here — both are DB-free, so
 * no need to widen the briefs module's exports) and writes to the context-files
 * hidden area via ContextFilesService.
 */
@Module({
  imports: [BusinessesModule, ContextFilesModule],
  controllers: [WebsiteFactsController],
  providers: [WebsiteFactsService, WebsiteExtractorService, ClaudeJsonService],
})
export class WebsiteFactsModule {}

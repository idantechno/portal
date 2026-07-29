import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { CustomersModule } from '../customers/customers.module';
import { DocumentsModule } from '../documents/documents.module';
import { Quote } from './quote.entity';
import { QuotesController } from './quotes.controller';
import { QuotesPublicController } from './quotes-public.controller';
import { QuotesService } from './quotes.service';
import { QuoteDrafterService } from './quote-drafter.service';
import { QuotePdfService } from './quote-pdf.service';
import { ClaudeJsonService } from '../briefs/claude-json.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote]),
    BusinessesModule,
    ContextFilesModule,
    // Validate the customer a quote is attached to.
    CustomersModule,
    // Reuse the single long-lived headless-Chromium instance for PDF export.
    DocumentsModule,
  ],
  controllers: [QuotesController, QuotesPublicController],
  // ClaudeJsonService only needs ConfigService, so it's provided here directly
  // (it isn't exported by BriefsModule) to power the business-aware drafter.
  providers: [
    QuotesService,
    QuoteDrafterService,
    QuotePdfService,
    ClaudeJsonService,
  ],
  exports: [QuotesService],
})
export class QuotesModule {}

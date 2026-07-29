import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { CustomersModule } from '../customers/customers.module';
import { Quote } from './quote.entity';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { QuoteDrafterService } from './quote-drafter.service';
import { ClaudeJsonService } from '../briefs/claude-json.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote]),
    BusinessesModule,
    ContextFilesModule,
    // Validate the customer a quote is attached to.
    CustomersModule,
  ],
  controllers: [QuotesController],
  // ClaudeJsonService only needs ConfigService, so it's provided here directly
  // (it isn't exported by BriefsModule) to power the business-aware drafter.
  providers: [QuotesService, QuoteDrafterService, ClaudeJsonService],
  exports: [QuotesService],
})
export class QuotesModule {}

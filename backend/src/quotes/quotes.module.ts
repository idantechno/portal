import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { CustomersModule } from '../customers/customers.module';
import { Quote } from './quote.entity';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote]),
    BusinessesModule,
    ContextFilesModule,
    // Validate the customer a quote is attached to.
    CustomersModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}

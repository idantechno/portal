import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { LeadsModule } from '../leads/leads.module';
import { CustomerContact } from '../conversations/customer-contact.entity';
import { Customer } from './customer.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';

/**
 * The central customers domain. Deliberately depends on nothing agent-specific
 * so the dependency arrow points the other way: BriefsModule / StrategiesModule
 * import THIS to validate a customer and attach documents to it.
 */
@Module({
  imports: [
    // CustomerContact is owned by ConversationsModule; we register its repo here
    // too (read-only promotion path) to avoid importing that whole module graph.
    TypeOrmModule.forFeature([Customer, CustomerContact]),
    BusinessesModule,
    // Promoting a lead reads it through LeadsService.
    LeadsModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { OwnerCommand } from './owner-command.entity';
import { OwnerConciergeService } from './owner-concierge.service';
import { OwnerCommandsProcessor } from './owner-commands.processor';
import { OWNER_COMMANDS_QUEUE } from './owner-commands.constants';
import { AgentsModule } from '../agents/agents.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { TasksModule } from '../tasks/tasks.module';
import { CustomersModule } from '../customers/customers.module';
import { LeadsModule } from '../leads/leads.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { FilingModule } from '../filing/filing.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

/**
 * The owner-over-WhatsApp concierge. The WhatsApp webhook enqueues owner
 * commands onto {@link OWNER_COMMANDS_QUEUE}; the processor here runs them and
 * sends the reply. Importing WhatsappModule (for send + media download) is safe
 * one-way — WhatsappModule does NOT import this module back, it only shares the
 * queue — so there's no DI cycle.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OwnerCommand]),
    BullModule.registerQueue({ name: OWNER_COMMANDS_QUEUE }),
    AgentsModule,
    ContextFilesModule,
    BusinessesModule,
    TasksModule,
    CustomersModule,
    LeadsModule,
    ExpensesModule,
    FilingModule,
    WhatsappModule,
  ],
  providers: [OwnerConciergeService, OwnerCommandsProcessor],
})
export class OwnerConciergeModule {}

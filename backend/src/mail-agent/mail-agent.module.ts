import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { AgentsModule } from '../agents/agents.module';
import { MailItem } from './mail-item.entity';
import { MAIL_AGENT_QUEUE } from './mail-agent.constants';
import { MailAgentService } from './mail-agent.service';
import { MailAgentProcessor } from './mail-agent.processor';
import { MailAgentController } from './mail-agent.controller';

/**
 * The mail agent (סוכן מייל). IntegrationsModule provides Gmail read access +
 * the shared token store; ExpensesModule lands approved invoices as expenses;
 * NotificationsModule rings the owner's bell; BusinessesModule/AgentsModule
 * power the per-business poll loop + entitlement gate.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MailItem]),
    BullModule.registerQueue({ name: MAIL_AGENT_QUEUE }),
    IntegrationsModule,
    ExpensesModule,
    NotificationsModule,
    BusinessesModule,
    AgentsModule,
  ],
  controllers: [MailAgentController],
  providers: [MailAgentService, MailAgentProcessor],
  exports: [MailAgentService],
})
export class MailAgentModule {}

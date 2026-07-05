import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { BusinessesModule } from '../../businesses/businesses.module';
import { ContextFilesModule } from '../../context-files/context-files.module';
import { TasksModule } from '../../tasks/tasks.module';
import { LeadsModule } from '../../leads/leads.module';
import { BillingModule } from '../../billing/billing.module';
import { ExpensesModule } from '../../expenses/expenses.module';
import { WorkspaceAgentService } from './workspace-agent.service';
import { WorkspaceAgentController } from './workspace-agent.controller';

@Module({
  imports: [
    AgentsModule,
    BusinessesModule,
    ContextFilesModule,
    TasksModule,
    LeadsModule,
    BillingModule,
    ExpensesModule,
  ],
  controllers: [WorkspaceAgentController],
  providers: [WorkspaceAgentService],
})
export class WorkspaceAgentModule {}

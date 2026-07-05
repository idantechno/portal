import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { LeadsModule } from '../leads/leads.module';
import { AgentsModule } from '../agents/agents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AGENT_RUNS_QUEUE } from './agent-worker.constants';
import { AgentWorkerService } from './agent-worker.service';
import { AgentWorkerProcessor } from './agent-worker.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: AGENT_RUNS_QUEUE }),
    BusinessesModule,
    ContextFilesModule,
    ConversationsModule,
    LeadsModule,
    AgentsModule,
    NotificationsModule,
  ],
  providers: [AgentWorkerService, AgentWorkerProcessor],
})
export class AgentWorkerModule {}

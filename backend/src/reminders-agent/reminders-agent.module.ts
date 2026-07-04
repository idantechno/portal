import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { TasksModule } from '../tasks/tasks.module';
import { RemindersAgentService } from './reminders-agent.service';
import { RemindersAgentController } from './reminders-agent.controller';

@Module({
  imports: [BusinessesModule, ContextFilesModule, AgentsModule, TasksModule],
  controllers: [RemindersAgentController],
  providers: [RemindersAgentService],
})
export class RemindersAgentModule {}

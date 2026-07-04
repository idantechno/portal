import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupportModule } from '../support/support.module';
import { MainAgentService } from './main-agent.service';
import { MainAgentController } from './main-agent.controller';

@Module({
  imports: [
    BusinessesModule,
    ContextFilesModule,
    AgentsModule,
    SupportModule,
    NotificationsModule,
  ],
  controllers: [MainAgentController],
  providers: [MainAgentService],
})
export class MainAgentModule {}

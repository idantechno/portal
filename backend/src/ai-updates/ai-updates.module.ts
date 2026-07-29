import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { AgentsModule } from '../agents/agents.module';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { AiUpdate } from './ai-update.entity';
import { AI_UPDATES_QUEUE } from './ai-updates.constants';
import { AiUpdatesService } from './ai-updates.service';
import { AiUpdatesProcessor } from './ai-updates.processor';
import {
  AiUpdatesController,
  AiUpdatesAdminController,
} from './ai-updates.controller';

/**
 * The AI-updates agent. ClaudeJsonService is provided directly here (it only
 * depends on ConfigService and isn't exported by BriefsModule) so this module
 * stays self-contained. NotificationsModule/BusinessesModule/AgentsModule power
 * the daily bell fan-out and the entitlement gate.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AiUpdate]),
    BullModule.registerQueue({ name: AI_UPDATES_QUEUE }),
    NotificationsModule,
    BusinessesModule,
    AgentsModule,
  ],
  controllers: [AiUpdatesController, AiUpdatesAdminController],
  providers: [AiUpdatesService, AiUpdatesProcessor, ClaudeJsonService],
  exports: [AiUpdatesService],
})
export class AiUpdatesModule {}

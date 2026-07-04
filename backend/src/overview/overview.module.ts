import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { OverviewService } from './overview.service';
import { OverviewController } from './overview.controller';

@Module({
  imports: [BusinessesModule, ContextFilesModule, AgentsModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}

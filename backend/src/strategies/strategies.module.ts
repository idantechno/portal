import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { BriefsModule } from '../briefs/briefs.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { DocumentsModule } from '../documents/documents.module';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { Strategy } from './strategy.entity';
import { StrategiesController } from './strategies.controller';
import { StrategiesService } from './strategies.service';
import { StrategyDrafterService } from './strategy-drafter.service';
import { StrategyGeneratorService } from './strategy-generator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Strategy]),
    AgentsModule,
    // BriefsModule exports BriefsService — the strategy stage reads (and gates
    // on) the approved brief through it.
    BriefsModule,
    BusinessesModule,
    ContextFilesModule,
    // Reuse the single long-lived headless-Chromium instance for client PDF export.
    DocumentsModule,
  ],
  controllers: [StrategiesController],
  providers: [
    StrategiesService,
    StrategyGeneratorService,
    StrategyDrafterService,
    // Re-provided here (BriefsModule keeps it private) — it's stateless and only
    // depends on ConfigService.
    ClaudeJsonService,
  ],
  exports: [StrategiesService],
})
export class StrategiesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { BriefsModule } from '../briefs/briefs.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { Objective } from './objective.entity';
import { ObjectivesController } from './objectives.controller';
import { ObjectivesService } from './objectives.service';
import { ObjectiveDrafterService } from './objective-drafter.service';
import { ObjectiveGeneratorService } from './objective-generator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Objective]),
    AgentsModule,
    // BriefsModule exports BriefsService — the doc is inferred from the brief.
    BriefsModule,
    BusinessesModule,
    ContextFilesModule,
  ],
  controllers: [ObjectivesController],
  providers: [
    ObjectivesService,
    ObjectiveGeneratorService,
    ObjectiveDrafterService,
    ClaudeJsonService,
  ],
  exports: [ObjectivesService],
})
export class ObjectivesModule {}

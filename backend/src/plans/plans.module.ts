import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { StrategiesModule } from '../strategies/strategies.module';
import { QuotesModule } from '../quotes/quotes.module';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { Plan } from './plan.entity';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlanDrafterService } from './plan-drafter.service';
import { PlanGeneratorService } from './plan-generator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan]),
    AgentsModule,
    // StrategiesModule exports StrategiesService — the plan stage reads (and
    // gates on) the approved strategy through it.
    StrategiesModule,
    // The plan requires (and reads) the customer's approved quote.
    QuotesModule,
    BusinessesModule,
    ContextFilesModule,
  ],
  controllers: [PlansController],
  providers: [
    PlansService,
    PlanGeneratorService,
    PlanDrafterService,
    // Re-provided here (kept private elsewhere) — stateless, depends only on
    // ConfigService.
    ClaudeJsonService,
  ],
  exports: [PlansService],
})
export class PlansModule {}

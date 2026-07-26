import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { AgentRunner } from './agent-runner.service';
import { BusinessAgent } from './business-agent.entity';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentsAdminController } from './agents-admin.controller';
import { MyAgentsController } from './my-agents.controller';
import { AgentRunController } from './agent-run.controller';
import { OrchestratorService } from './orchestrator/orchestrator.service';
import { RequireAgentGuard } from './guards/require-agent.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessAgent]),
    BusinessesModule,
    BillingModule,
    AuditModule,
    ContextFilesModule,
  ],
  controllers: [
    AgentsController,
    AgentsAdminController,
    MyAgentsController,
    AgentRunController,
  ],
  // AgentRunner is the generic SDK executor; AgentsService manages per-business
  // agent entitlements; OrchestratorService routes owner-facing agent runs.
  providers: [
    AgentRunner,
    AgentsService,
    OrchestratorService,
    RequireAgentGuard,
  ],
  exports: [AgentRunner, AgentsService, OrchestratorService, RequireAgentGuard],
})
export class AgentsModule {}

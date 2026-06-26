import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { AuditModule } from '../audit/audit.module';
import { AgentRunner } from './agent-runner.service';
import { BusinessAgent } from './business-agent.entity';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentsAdminController } from './agents-admin.controller';
import { MyAgentsController } from './my-agents.controller';
import { RequireAgentGuard } from './guards/require-agent.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessAgent]),
    BusinessesModule,
    AuditModule,
  ],
  controllers: [AgentsController, AgentsAdminController, MyAgentsController],
  // AgentRunner is the generic SDK executor; AgentsService manages per-business
  // agent entitlements. Both live in the agents domain.
  providers: [AgentRunner, AgentsService, RequireAgentGuard],
  exports: [AgentRunner, AgentsService, RequireAgentGuard],
})
export class AgentsModule {}

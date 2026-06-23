import { Module } from '@nestjs/common';
import { AgentRunner } from './agent-runner.service';

@Module({
  providers: [AgentRunner],
  exports: [AgentRunner],
})
export class AgentsModule {}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AGENT_RUNS_QUEUE, AgentRunJobData } from './agent-worker.constants';
import { AgentWorkerService } from './agent-worker.service';

@Processor(AGENT_RUNS_QUEUE)
export class AgentWorkerProcessor extends WorkerHost {
  private readonly log = new Logger(AgentWorkerProcessor.name);

  constructor(private readonly service: AgentWorkerService) {
    super();
  }

  async process(job: Job<AgentRunJobData>): Promise<void> {
    this.log.log(
      `Running agent for conversation ${job.data.conversationId} (job ${job.id})`,
    );
    await this.service.runAgent(job.data);
  }
}

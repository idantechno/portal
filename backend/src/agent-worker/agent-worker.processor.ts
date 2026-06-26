import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AGENT_RUNS_QUEUE, AgentRunJobData } from './agent-worker.constants';
import { AgentWorkerService } from './agent-worker.service';

// How many conversations the worker processes in parallel. Tune per Anthropic
// rate limits / CPU. Read at module load so it can be set per-environment.
const CONCURRENCY = Number(process.env.AGENT_WORKER_CONCURRENCY ?? 5);

@Processor(AGENT_RUNS_QUEUE, { concurrency: CONCURRENCY })
export class AgentWorkerProcessor extends WorkerHost {
  private readonly log = new Logger(AgentWorkerProcessor.name);

  constructor(private readonly service: AgentWorkerService) {
    super();
  }

  async process(job: Job<AgentRunJobData>): Promise<void> {
    this.log.log(
      `Running agent for conversation ${job.data.conversationId} (job ${job.id}, attempt ${job.attemptsMade + 1})`,
    );
    await this.service.runAgent(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AgentRunJobData> | undefined, err: Error): void {
    if (!job) {
      this.log.error(`Agent job failed with no job context: ${err.message}`);
      return;
    }
    const max = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= max;
    this.log.error(
      `Agent job ${job.id} failed (attempt ${job.attemptsMade}/${max}${
        exhausted ? ', exhausted' : ', will retry'
      }) for conversation ${job.data.conversationId}: ${err.message}`,
    );
  }
}

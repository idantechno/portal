import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AGENT_RUNS_QUEUE, AgentRunJobData } from './agent-worker.constants';
import { AgentWorkerService } from './agent-worker.service';
import { NotificationsService } from '../notifications/notifications.service';

// How many conversations the worker processes in parallel. Tune per Anthropic
// rate limits / CPU. Read at module load so it can be set per-environment.
const CONCURRENCY = Number(process.env.AGENT_WORKER_CONCURRENCY ?? 5);

@Processor(AGENT_RUNS_QUEUE, { concurrency: CONCURRENCY })
export class AgentWorkerProcessor extends WorkerHost {
  private readonly log = new Logger(AgentWorkerProcessor.name);

  constructor(
    private readonly service: AgentWorkerService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<AgentRunJobData>): Promise<void> {
    this.log.log(
      `Running agent for conversation ${job.data.conversationId} (job ${job.id}, attempt ${job.attemptsMade + 1})`,
    );
    await this.service.runAgent(job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<AgentRunJobData> | undefined,
    err: Error,
  ): Promise<void> {
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

    // On terminal failure the customer's message went unanswered. Surface it as
    // an in-app notification so the business isn't silently left hanging — a
    // human can open the inbox and reply. Never let a notification error mask
    // the original failure.
    if (exhausted) {
      try {
        await this.notifications.notify({
          businessId: job.data.businessId,
          type: 'system',
          title: 'הסוכן לא הצליח להשיב להודעת לקוח',
          body: 'הודעת לקוח נכנסה אך הסוכן נכשל במענה. פתח את תיבת השיחות כדי להשיב ידנית.',
          link: `/app/businesses/${job.data.businessId}/inbox`,
        });
      } catch (notifyErr) {
        this.log.error(
          `Failed to emit exhausted-run notification for business ${job.data.businessId}: ${(notifyErr as Error).message}`,
        );
      }
    }
  }
}

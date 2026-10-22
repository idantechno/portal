import { Processor, WorkerHost } from '@nestjs/bullmq';
import { MAIL_AGENT_QUEUE } from './mail-agent.constants';
import { MailAgentService } from './mail-agent.service';

/**
 * Runs the scheduled mail-agent sweep: polls every entitled + Gmail-connected
 * business and enqueues invoice candidates into the approval queue.
 */
@Processor(MAIL_AGENT_QUEUE)
export class MailAgentProcessor extends WorkerHost {
  constructor(private readonly service: MailAgentService) {
    super();
  }

  process(): Promise<void> {
    // Scheduled sweep is disabled — drop any job still queued from before.
    return Promise.resolve();
  }
}

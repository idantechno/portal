import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AI_UPDATES_QUEUE } from './ai-updates.constants';
import { AiUpdatesService } from './ai-updates.service';

/**
 * Runs the scheduled digest generation. Job name selects which digest:
 * 'daily' → business digest (+ bell fan-out); 'weekly' → internal digest.
 */
@Processor(AI_UPDATES_QUEUE)
export class AiUpdatesProcessor extends WorkerHost {
  private readonly log = new Logger(AiUpdatesProcessor.name);

  constructor(private readonly service: AiUpdatesService) {
    super();
  }

  process(job: Job): Promise<void> {
    // Scheduled digests are disabled (API cost). Drop any job still queued
    // from before the schedule was removed instead of calling the model.
    this.log.log(`ai-updates job "${job.name}" skipped — schedule disabled.`);
    return Promise.resolve();
  }
}

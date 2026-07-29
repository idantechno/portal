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

  async process(job: Job): Promise<void> {
    if (job.name === 'weekly') {
      await this.service.generateWeeklyInternalUpdate();
      return;
    }
    if (job.name === 'daily') {
      await this.service.generateDailyBusinessUpdate();
      return;
    }
    this.log.warn(`Unknown ai-updates job "${job.name}" — ignored.`);
  }
}

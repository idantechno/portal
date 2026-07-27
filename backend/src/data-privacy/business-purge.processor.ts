import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { BUSINESS_PURGE_QUEUE } from './business-purge.constants';
import { BusinessPurgeScheduler } from './business-purge.scheduler';

/** Runs the tenant-purge sweep whenever the daily repeatable job fires. */
@Processor(BUSINESS_PURGE_QUEUE)
export class BusinessPurgeProcessor extends WorkerHost {
  private readonly log = new Logger(BusinessPurgeProcessor.name);

  constructor(private readonly scheduler: BusinessPurgeScheduler) {
    super();
  }

  async process(): Promise<void> {
    const purged = await this.scheduler.sweep();
    if (purged > 0) {
      this.log.log(`Tenant-purge sweep removed ${purged} tenant(s).`);
    }
  }
}

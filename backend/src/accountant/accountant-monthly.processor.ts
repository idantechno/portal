import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ACCOUNTANT_MONTHLY_QUEUE } from './accountant-monthly.constants';
import { AccountantMonthlyService } from './accountant-monthly.service';

/** Runs the monthly accountant send whenever the repeatable job fires. */
@Processor(ACCOUNTANT_MONTHLY_QUEUE)
export class AccountantMonthlyProcessor extends WorkerHost {
  private readonly log = new Logger(AccountantMonthlyProcessor.name);

  constructor(private readonly service: AccountantMonthlyService) {
    super();
  }

  process(): Promise<void> {
    // Monthly auto-send is disabled — drop any job still queued from before.
    this.log.log('Monthly accountant send skipped — schedule disabled.');
    return Promise.resolve();
  }
}

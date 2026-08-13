import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BusinessesService } from '../businesses/businesses.service';
import { AccountantService } from './accountant.service';
import { ACCOUNTANT_MONTHLY_QUEUE } from './accountant-monthly.constants';

/**
 * Once a month (06:00 UTC on the 1st) sends every business that has an
 * accountant recipient its PREVIOUS month's document package. Best-effort per
 * business — one failure never stops the rest. Businesses without a recipient
 * (or without Gmail connected) simply produce no send.
 */
@Injectable()
export class AccountantMonthlyService implements OnModuleInit {
  private readonly log = new Logger(AccountantMonthlyService.name);

  constructor(
    private readonly businesses: BusinessesService,
    private readonly accountant: AccountantService,
    @InjectQueue(ACCOUNTANT_MONTHLY_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        'run',
        {},
        { repeat: { pattern: '0 6 1 * *' }, removeOnComplete: true },
      );
    } catch (err) {
      this.log.error(
        `Failed to schedule monthly accountant send: ${(err as Error).message}`,
      );
    }
  }

  /** Send last month's package to every business that has a recipient set. */
  async run(): Promise<number> {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prev.getFullYear();
    const month = prev.getMonth() + 1; // 1-12

    const businesses = await this.businesses.listAll();
    let sent = 0;
    for (const b of businesses) {
      if (!b.accountantEmail && !b.accountantPhone) continue;
      try {
        await this.accountant.sendToAccountant(b.id, { year, month });
        sent += 1;
      } catch (err) {
        this.log.warn(
          `[accountant] monthly send failed for ${b.id}: ${(err as Error).message}`,
        );
      }
    }
    if (sent > 0)
      this.log.log(`Monthly accountant send: ${sent} business(es).`);
    return sent;
  }
}

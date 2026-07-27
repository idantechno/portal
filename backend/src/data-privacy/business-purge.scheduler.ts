import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { Business } from '../businesses/business.entity';
import { AuditService } from '../audit/audit.service';
import { BusinessPurgeService } from './business-purge.service';
import {
  BUSINESS_PURGE_QUEUE,
  PURGE_AFTER_DAYS,
} from './business-purge.constants';

/**
 * Schedules and runs the daily sweep that hard-purges tenants whose 30-day
 * grace window has elapsed. Modeled on the unsigned-document reminder job.
 */
@Injectable()
export class BusinessPurgeScheduler implements OnModuleInit {
  private readonly log = new Logger(BusinessPurgeScheduler.name);

  constructor(
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    private readonly purge: BusinessPurgeService,
    private readonly audit: AuditService,
    @InjectQueue(BUSINESS_PURGE_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Daily at 03:00. BullMQ dedupes repeatable jobs by their repeat options,
    // so re-adding on every boot does not stack duplicates.
    try {
      await this.queue.add(
        'sweep',
        {},
        { repeat: { pattern: '0 3 * * *' }, removeOnComplete: true },
      );
    } catch (err) {
      this.log.error(
        `Failed to schedule tenant-purge sweep: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Find every tenant soft-deleted longer than the grace window and purge it.
   * `withDeleted` is required — soft-deleted rows are hidden by default.
   * Returns how many tenants were purged.
   */
  async sweep(): Promise<number> {
    const cutoff = new Date(
      Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000,
    );
    const due = await this.businesses.find({
      withDeleted: true,
      where: { deletedAt: LessThan(cutoff) },
    });

    for (const business of due) {
      try {
        await this.purge.purge(business.id);
        await this.audit.record({
          actorRole: 'system',
          action: 'business.purged',
          businessId: business.id,
          targetType: 'business',
          targetId: business.id,
          metadata: {
            name: business.name,
            slug: business.slug,
            deletedAt: business.deletedAt,
          },
        });
      } catch (err) {
        this.log.error(
          `Failed to purge tenant ${business.id}: ${(err as Error).message}`,
        );
      }
    }
    if (due.length > 0) {
      this.log.log(`Tenant-purge sweep removed ${due.length} tenant(s).`);
    }
    return due.length;
  }
}

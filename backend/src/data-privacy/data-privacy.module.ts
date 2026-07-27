import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Business } from '../businesses/business.entity';
import { BusinessesModule } from '../businesses/businesses.module';
import { AuditModule } from '../audit/audit.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { BUSINESS_PURGE_QUEUE } from './business-purge.constants';
import { BusinessPurgeService } from './business-purge.service';
import { BusinessPurgeScheduler } from './business-purge.scheduler';
import { BusinessPurgeProcessor } from './business-purge.processor';
import { ContactErasureService } from './contact-erasure.service';
import { DataPrivacyController } from './data-privacy.controller';

/**
 * Owns the destructive data-deletion paths in one auditable place:
 *  - Level A: erase a single end-customer / lead ("right to be forgotten").
 *  - Level B: hard-purge a whole tenant once its 30-day grace window elapses
 *    (the daily job); the soft-delete/restore that starts the window lives on
 *    BusinessesService and is triggered from the admin surface.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Business]),
    BullModule.registerQueue({ name: BUSINESS_PURGE_QUEUE }),
    BusinessesModule,
    AuditModule,
    ContextFilesModule,
  ],
  controllers: [DataPrivacyController],
  providers: [
    BusinessPurgeService,
    BusinessPurgeScheduler,
    BusinessPurgeProcessor,
    ContactErasureService,
  ],
  exports: [BusinessPurgeService],
})
export class DataPrivacyModule {}

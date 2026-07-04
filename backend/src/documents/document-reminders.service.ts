import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { DocumentInstance } from './document-instance.entity';
import { DocumentStatus } from '../common/enums/document-status.enum';
import { TasksService } from '../tasks/tasks.service';
import { DOCUMENT_REMINDERS_QUEUE } from './document-reminders.constants';

/** A client-sign document unsigned longer than this raises a reminder. */
const UNSIGNED_HOURS = 24;

/**
 * Periodically finds documents that were sent to a client for signature but
 * remain unsigned for more than 24h, and raises a single reminder (a task) for
 * the business so the owner follows up. Scheduled as an hourly BullMQ
 * repeatable job; the sweep itself is idempotent (deduped per document).
 */
@Injectable()
export class DocumentRemindersService implements OnModuleInit {
  private readonly log = new Logger(DocumentRemindersService.name);

  constructor(
    @InjectRepository(DocumentInstance)
    private readonly docs: Repository<DocumentInstance>,
    private readonly tasks: TasksService,
    @InjectQueue(DOCUMENT_REMINDERS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Register the hourly sweep. BullMQ dedupes repeatable jobs by their repeat
    // options, so re-adding on every boot does not stack duplicates.
    try {
      await this.queue.add(
        'sweep',
        {},
        { repeat: { pattern: '0 * * * *' }, removeOnComplete: true },
      );
    } catch (err) {
      this.log.error(
        `Failed to schedule unsigned-document sweep: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Scan all businesses for client-sign documents unsigned for >24h and raise
   * one reminder per document. Returns how many reminders were created.
   */
  async sweep(): Promise<number> {
    const cutoff = new Date(Date.now() - UNSIGNED_HOURS * 60 * 60 * 1000);
    const docs = await this.docs.find({
      where: {
        // publicToken present = a client-sign document (has a signing page).
        publicToken: Not(IsNull()),
        signedAt: IsNull(),
        status: In([DocumentStatus.Draft, DocumentStatus.Sent]),
        createdAt: LessThan(cutoff),
      },
    });

    let created = 0;
    for (const doc of docs) {
      const already = await this.tasks.existsForRelated(
        doc.businessId,
        'document',
        doc.id,
      );
      if (already) continue;
      const signer = doc.recipientFields?.signerFullName?.trim();
      await this.tasks.create({
        businessId: doc.businessId,
        title: signer
          ? `חוזה של ${signer} ממתין לחתימה כבר יממה`
          : 'חוזה שנשלח ממתין לחתימה כבר יממה',
        description: 'המסמך נשלח לחתימה ועדיין לא נחתם. כדאי לתזכר את הלקוח.',
        dueAt: new Date(),
        source: 'automation',
        priority: 'high',
        relatedType: 'document',
        relatedId: doc.id,
      });
      created += 1;
    }
    if (created > 0) {
      this.log.log(`Raised ${created} unsigned-document reminder(s).`);
    }
    return created;
  }
}

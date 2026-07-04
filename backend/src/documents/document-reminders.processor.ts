import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DOCUMENT_REMINDERS_QUEUE } from './document-reminders.constants';
import { DocumentRemindersService } from './document-reminders.service';

/** Runs the unsigned-document sweep whenever the repeatable job fires. */
@Processor(DOCUMENT_REMINDERS_QUEUE)
export class DocumentRemindersProcessor extends WorkerHost {
  private readonly log = new Logger(DocumentRemindersProcessor.name);

  constructor(private readonly service: DocumentRemindersService) {
    super();
  }

  async process(): Promise<void> {
    const created = await this.service.sweep();
    if (created > 0) {
      this.log.log(`Unsigned-document sweep created ${created} reminder(s).`);
    }
  }
}

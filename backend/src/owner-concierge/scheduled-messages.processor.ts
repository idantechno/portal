import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { SCHEDULED_MESSAGES_QUEUE } from './scheduled-messages.constants';
import { ScheduledMessagesService } from './scheduled-messages.service';

/** Runs the due-message delivery sweep whenever the repeatable job fires. */
@Processor(SCHEDULED_MESSAGES_QUEUE)
export class ScheduledMessagesProcessor extends WorkerHost {
  private readonly log = new Logger(ScheduledMessagesProcessor.name);

  constructor(private readonly service: ScheduledMessagesService) {
    super();
  }

  async process(): Promise<void> {
    const sent = await this.service.sweep();
    if (sent > 0)
      this.log.log(`Scheduled-messages sweep delivered ${sent} message(s).`);
  }
}

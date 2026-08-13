import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CALENDAR_RECONCILE_QUEUE } from './calendar-reconcile.constants';
import { CalendarReconcileService } from './calendar-reconcile.service';

/** Runs the Google Calendar reconcile sweep whenever the repeatable job fires. */
@Processor(CALENDAR_RECONCILE_QUEUE)
export class CalendarReconcileProcessor extends WorkerHost {
  private readonly log = new Logger(CalendarReconcileProcessor.name);

  constructor(private readonly service: CalendarReconcileService) {
    super();
  }

  async process(): Promise<void> {
    const stats = await this.service.sweep();
    if (stats.moved || stats.cancelled || stats.mirrored) {
      this.log.log(
        `Reconcile fired — moved ${stats.moved}, cancelled ${stats.cancelled}, mirrored ${stats.mirrored}.`,
      );
    }
  }
}

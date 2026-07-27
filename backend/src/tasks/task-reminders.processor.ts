import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { TASK_REMINDERS_QUEUE } from './task-reminders.constants';
import { TaskRemindersService } from './task-reminders.service';

/** Runs the due-task reminder sweep whenever the repeatable job fires. */
@Processor(TASK_REMINDERS_QUEUE)
export class TaskRemindersProcessor extends WorkerHost {
  private readonly log = new Logger(TaskRemindersProcessor.name);

  constructor(private readonly service: TaskRemindersService) {
    super();
  }

  async process(): Promise<void> {
    const sent = await this.service.sweep();
    if (sent > 0)
      this.log.log(`Task-reminders sweep fired ${sent} reminder(s).`);
  }
}

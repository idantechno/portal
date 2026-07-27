import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BusinessesModule } from '../businesses/businesses.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TASK_REMINDERS_QUEUE } from './task-reminders.constants';
import { TaskRemindersService } from './task-reminders.service';
import { TaskRemindersProcessor } from './task-reminders.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    BullModule.registerQueue({ name: TASK_REMINDERS_QUEUE }),
    BusinessesModule,
    BillingModule,
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TaskRemindersService, TaskRemindersProcessor],
  exports: [TasksService],
})
export class TasksModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/appointment.entity';
import { TasksModule } from '../tasks/tasks.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ScheduleService } from './schedule.service';

/**
 * The schedule brain. Registers the Appointment repo directly (rather than
 * importing AppointmentsModule) so AppointmentsModule can import THIS without a
 * dependency cycle.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    TasksModule,
    IntegrationsModule,
  ],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}

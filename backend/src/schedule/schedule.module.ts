import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/appointment.entity';
import { TasksModule } from '../tasks/tasks.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';

/**
 * The schedule brain. Registers the Appointment repo directly (rather than
 * importing AppointmentsModule) so AppointmentsModule can import THIS without a
 * dependency cycle. BusinessesModule is needed by the controller's
 * BusinessScopeGuard.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    TasksModule,
    IntegrationsModule,
    BusinessesModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}

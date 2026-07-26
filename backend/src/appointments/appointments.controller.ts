import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { RequireCapabilityGuard } from '../billing/guards/require-capability.guard';
import { RequireCapability } from '../billing/decorators/require-capability.decorator';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentStatusDto,
} from './dto/appointment.dto';
import { parseIsraelDate } from '../common/time/israel-time';

@UseGuards(BusinessScopeGuard, RequireCapabilityGuard)
@Controller('businesses/:businessId/appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  // Reads stay open (dashboard widgets); manual booking/editing is gated. The
  // agent's own booking path goes through the service, not this controller, and
  // is gated separately by the `agent_scheduling` capability.
  @Get()
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.appointments.list(businessId, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      status: query.status,
    });
  }

  @Post()
  @RequireCapability('calendar_manual')
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    const startAt = parseIsraelDate(dto.start);
    if (!startAt) throw new BadRequestException('Invalid start time');
    const endAt = dto.end
      ? parseIsraelDate(dto.end)
      : new Date(startAt.getTime() + 60 * 60 * 1000);
    if (!endAt) throw new BadRequestException('Invalid end time');
    return this.appointments.book({
      businessId,
      title: dto.title,
      startAt,
      endAt,
      customerContactId: dto.customerContactId ?? null,
      customerName: dto.customerName ?? null,
      phone: dto.phone ?? null,
      notes: dto.notes ?? null,
      source: 'manual',
    });
  }

  @Post(':appointmentId/cancel')
  @RequireCapability('calendar_manual')
  cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.appointments.cancel(businessId, appointmentId);
  }

  @Patch(':appointmentId/status')
  @RequireCapability('calendar_manual')
  setStatus(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointments.setStatus(businessId, appointmentId, dto.status);
  }
}

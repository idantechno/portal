import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { TasksService } from './tasks.service';
import { TaskStatus } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('status') status?: TaskStatus,
  ) {
    return this.tasks.list(businessId, status);
  }

  @Post()
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasks.create({
      businessId,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      dueAt: dto.dueAt,
      relatedType: dto.relatedType,
      relatedId: dto.relatedId,
      source: 'manual',
      createdByUserId: user.id,
    });
  }

  @Patch(':id')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(businessId, id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.tasks.remove(businessId, id);
    return { ok: true };
  }
}

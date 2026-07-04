import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { RemindersAgentService } from './reminders-agent.service';
import { RemindersChatDto } from './dto/reminders-chat.dto';

@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('reminders')
@Controller('businesses/:businessId')
export class RemindersAgentController {
  constructor(private readonly agent: RemindersAgentService) {}

  @Post('agents/reminders/chat')
  chat(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: RemindersChatDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agent.chat({
      businessId,
      userId: user.id,
      history: dto.history,
    });
  }
}

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
import { MainAgentService } from './main-agent.service';
import { MainChatDto } from './dto/main-chat.dto';

@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('main')
@Controller('businesses/:businessId')
export class MainAgentController {
  constructor(private readonly agent: MainAgentService) {}

  @Post('agents/main/chat')
  chat(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: MainChatDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agent.chat({
      businessId,
      userId: user.id,
      history: dto.history,
    });
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { IdeasAgentService } from './ideas-agent.service';
import { IdeasService } from './ideas.service';
import { IdeasChatDto } from './dto/ideas-chat.dto';

@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('ideas')
@Controller('businesses/:businessId')
export class IdeasController {
  constructor(
    private readonly ideas: IdeasService,
    private readonly agent: IdeasAgentService,
  ) {}

  @Post('agents/ideas/chat')
  chat(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: IdeasChatDto,
  ) {
    return this.agent.chat({ businessId, history: dto.history });
  }

  @Get('ideas')
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.ideas.list(businessId);
  }

  @Get('ideas/:id')
  get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ideas.findByIdScoped(businessId, id);
  }

  @Delete('ideas/:id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.ideas.remove(businessId, id);
    return { ok: true };
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { ConversationsService } from './conversations.service';
import { ChannelRegistry } from '../channels/channel-registry.service';
import { MessageRole } from '../common/enums/message-role.enum';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
import { ListConversationsQueryDto } from './dto/list-conversations.dto';
import { SendAgentReplyDto } from './dto/send-agent-reply.dto';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly channels: ChannelRegistry,
  ) {}

  @Get()
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.conversations.list(businessId, query);
  }

  @Get(':conversationId')
  get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.findByIdScoped(businessId, conversationId);
  }

  @Get(':conversationId/messages')
  messages(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.listMessages(businessId, conversationId);
  }

  @Post(':conversationId/messages')
  async sendAgentReply(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendAgentReplyDto,
  ) {
    // Sending an agent reply implies takeover if the bot was driving.
    const conversation = await this.conversations.takeover(
      businessId,
      conversationId,
      user.id,
    );
    const message = await this.conversations.appendMessage({
      businessId,
      conversationId,
      role: MessageRole.Agent,
      content: dto.content,
      agentUserId: user.id,
    });
    await this.channels.dispatch(conversation, message);
    return message;
  }

  @Post(':conversationId/takeover')
  takeover(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversations.takeover(businessId, conversationId, user.id);
  }

  @Post(':conversationId/return-to-bot')
  returnToBot(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.returnToBot(businessId, conversationId);
  }

  @Post(':conversationId/close')
  close(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.setStatus(
      businessId,
      conversationId,
      ConversationStatus.Closed,
    );
  }
}

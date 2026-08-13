import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { AgentChatMessage } from './agent-chat-message.entity';
import { AgentChatService } from './agent-chat.service';
import { AgentChatController } from './agent-chat.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentChatMessage]),
    // BusinessScopeGuard resolves the business from BusinessesModule.
    BusinessesModule,
  ],
  controllers: [AgentChatController],
  providers: [AgentChatService],
  exports: [AgentChatService],
})
export class AgentChatModule {}

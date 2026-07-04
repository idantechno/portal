import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { Idea } from './idea.entity';
import { IdeasAgentService } from './ideas-agent.service';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Idea]),
    BusinessesModule,
    ContextFilesModule,
    AgentsModule,
  ],
  controllers: [IdeasController],
  providers: [IdeasService, IdeasAgentService],
  exports: [IdeasService],
})
export class IdeasModule {}

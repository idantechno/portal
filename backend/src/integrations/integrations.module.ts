import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { Integration } from './integration.entity';
import { IntegrationsService } from './integrations.service';
import { GmailService } from './gmail.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsGoogleController } from './integrations-google.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Integration]), BusinessesModule],
  controllers: [IntegrationsController, IntegrationsGoogleController],
  providers: [IntegrationsService, GmailService],
  exports: [IntegrationsService, GmailService],
})
export class IntegrationsModule {}

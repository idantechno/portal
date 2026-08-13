import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../common/crypto/crypto.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { CrmConnection } from './crm-connection.entity';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { WebhookCrmAdapter } from './adapters/webhook.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([CrmConnection]),
    CryptoModule,
    // BusinessScopeGuard + business-name lookups.
    BusinessesModule,
  ],
  controllers: [CrmController],
  providers: [CrmService, WebhookCrmAdapter],
  exports: [CrmService],
})
export class CrmModule {}

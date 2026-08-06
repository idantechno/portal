import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../businesses/business.entity';
import { BusinessesModule } from '../businesses/businesses.module';
import { SupportRequest } from './support-request.entity';
import { SupportRequestsService } from './support-requests.service';
import { SupportAdminController } from './support-admin.controller';
import { SupportController } from './support.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportRequest, Business]),
    // Needed by BusinessScopeGuard (BusinessesService) on the owner-facing
    // support controller.
    BusinessesModule,
  ],
  controllers: [SupportAdminController, SupportController],
  providers: [SupportRequestsService],
  exports: [SupportRequestsService],
})
export class SupportModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../businesses/business.entity';
import { SupportRequest } from './support-request.entity';
import { SupportRequestsService } from './support-requests.service';
import { SupportAdminController } from './support-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SupportRequest, Business])],
  controllers: [SupportAdminController],
  providers: [SupportRequestsService],
  exports: [SupportRequestsService],
})
export class SupportModule {}

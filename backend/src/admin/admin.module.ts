import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../businesses/business.entity';
import { BusinessMember } from '../businesses/business-member.entity';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, BusinessMember]),
    UsersModule,
    AuditModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

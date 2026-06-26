import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { Business } from './business.entity';
import { BusinessMember } from './business-member.entity';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { BusinessScopeGuard } from './guards/business-scope.guard';
import { BusinessRoleGuard } from './guards/business-role.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, BusinessMember]),
    UsersModule,
    AuditModule,
  ],
  controllers: [BusinessesController],
  providers: [BusinessesService, BusinessScopeGuard, BusinessRoleGuard],
  exports: [BusinessesService, BusinessScopeGuard, BusinessRoleGuard],
})
export class BusinessesModule {}

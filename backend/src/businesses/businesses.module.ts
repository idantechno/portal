import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Business } from './business.entity';
import { BusinessMember } from './business-member.entity';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { BusinessScopeGuard } from './guards/business-scope.guard';
import { BusinessOwnerGuard } from './guards/business-owner.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Business, BusinessMember]), UsersModule],
  controllers: [BusinessesController],
  providers: [BusinessesService, BusinessScopeGuard, BusinessOwnerGuard],
  exports: [BusinessesService, BusinessScopeGuard, BusinessOwnerGuard],
})
export class BusinessesModule {}

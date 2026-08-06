import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { BusinessTemplate } from './business-template.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { TemplatesAdminController } from './templates-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessTemplate]),
    AuditModule,
    // BusinessScopeGuard (on the business-facing controller) needs BusinessesService.
    BusinessesModule,
  ],
  controllers: [TemplatesController, TemplatesAdminController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}

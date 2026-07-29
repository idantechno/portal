import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../businesses/business.entity';
import { User } from '../users/user.entity';
import { BusinessesModule } from '../businesses/businesses.module';
import { CustomersModule } from '../customers/customers.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { DocumentsModule } from '../documents/documents.module';
import { QuestionnaireModule } from '../questionnaire/questionnaire.module';
import { WebsiteIntake } from './website-intake.entity';
import { WebsiteIntakeService } from './website-intake.service';
import { WebsiteIntakePdfService } from './website-intake-pdf.service';
import { WebsiteIntakeController } from './website-intake.controller';

/**
 * Public website-intake form + operator read side. Reuses CustomersService
 * (find-or-create with dedupe), FilesystemService (asset storage under the
 * platform business workspace) and the QuestionnaireModule's OperatorNotifier.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WebsiteIntake, Business, User]),
    // BusinessScopeGuard on the read routes resolves membership through this.
    BusinessesModule,
    CustomersModule,
    ContextFilesModule,
    // Reuse the single long-lived headless-Chromium instance for PDF export.
    DocumentsModule,
    QuestionnaireModule,
  ],
  controllers: [WebsiteIntakeController],
  providers: [WebsiteIntakeService, WebsiteIntakePdfService],
})
export class WebsiteIntakeModule {}

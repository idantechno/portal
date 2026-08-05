import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../businesses/business.entity';
import { User } from '../users/user.entity';
import { LeadsModule } from '../leads/leads.module';
import { CustomersModule } from '../customers/customers.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { QuestionnaireController } from './questionnaire.controller';
import { QuestionnaireService } from './questionnaire.service';
import { OperatorNotifierService } from './operator-notifier.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, User]),
    LeadsModule,
    CustomersModule,
    IntegrationsModule,
    WhatsappModule,
  ],
  controllers: [QuestionnaireController],
  providers: [QuestionnaireService, OperatorNotifierService],
  // WebsiteIntakeModule reuses the same out-of-band operator notifier.
  exports: [OperatorNotifierService],
})
export class QuestionnaireModule {}

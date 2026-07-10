import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { SubmitQuestionnaireDto } from './dto/submit-questionnaire.dto';
import { QuestionnaireService } from './questionnaire.service';

/**
 * Public, unauthenticated endpoint for the marketing strategy questionnaire.
 * Sent as a link to prospects (who may not be customers yet). Rate-limited and
 * honeypot-guarded against spam; each submission becomes a lead + operator
 * notification. See QuestionnaireService.
 */
@Public()
@Controller('questionnaire')
export class QuestionnaireController {
  constructor(private readonly questionnaire: QuestionnaireService) {}

  // A submission writes a lead + attempts email/WhatsApp — cap per IP so a
  // scripted flood can't spam the operator or the leads table.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post()
  submit(@Body() dto: SubmitQuestionnaireDto) {
    return this.questionnaire.submit(dto);
  }
}

import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SupportRequestsService } from './support-requests.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';

/**
 * Owner-facing entry to the support inbox. No @Roles — any member of the
 * business (guarded by BusinessScopeGuard) may reach the operator for help.
 * Requests land in the SAME cross-tenant inbox platform staff already watch;
 * the subject marks them as a support enquiry so they read distinctly from
 * automation requests / agent escalations.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/support-requests')
export class SupportController {
  constructor(private readonly support: SupportRequestsService) {}

  @Post()
  async create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateSupportRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    const headline = dto.subject?.trim();
    await this.support.create({
      businessId,
      createdByUserId: user.id,
      subject: headline ? `פנייה לתמיכה — ${headline}` : 'פנייה לתמיכה',
      details: dto.message.trim(),
    });
    return { ok: true };
  }
}

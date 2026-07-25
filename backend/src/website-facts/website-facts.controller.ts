import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { isPlatformStaff } from '../common/enums/user-role.enum';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { WebsiteFactsService } from './website-facts.service';
import { ImportWebsiteFactsDto } from './dto/import-website-facts.dto';

/**
 * Operator-only: crawl the business's website and write the extracted facts to
 * `_hidden/website-facts.md`. Same authority as writing any hidden context file
 * (platform staff), enforced inline — mirrors the context-files controller.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/website-facts')
export class WebsiteFactsController {
  constructor(private readonly websiteFacts: WebsiteFactsService) {}

  @Post('import')
  import(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: ImportWebsiteFactsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!isPlatformStaff(user.role)) {
      throw new ForbiddenException(
        'רק אופרייטור יכול לייבא עובדות מהאתר לאזור המוסתר.',
      );
    }
    return this.websiteFacts.importFacts(businessId, user.id, dto.url);
  }
}

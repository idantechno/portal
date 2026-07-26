import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { RequireCapabilityGuard } from '../billing/guards/require-capability.guard';
import { RequireCapability } from '../billing/decorators/require-capability.decorator';
import { IntegrationsService } from './integrations.service';
import { GmailService } from './gmail.service';
import { SendEmailDto } from './dto/send-email.dto';
import { isIntegrationProvider } from './integration.constants';

@UseGuards(BusinessScopeGuard, RequireCapabilityGuard)
@Controller('businesses/:businessId/integrations')
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly gmail: GmailService,
  ) {}

  @Post('gmail/send')
  @RequireCapability('google')
  sendEmail(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: SendEmailDto,
  ) {
    return this.gmail.sendEmail(businessId, dto);
  }

  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.integrations.list(businessId);
  }

  @Get(':provider/auth-url')
  @RequireCapability('google')
  authUrl(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('provider') provider: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!isIntegrationProvider(provider)) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }
    return { url: this.integrations.authUrl(businessId, provider, user.id) };
  }

  @Post(':provider/disconnect')
  async disconnect(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('provider') provider: string,
  ) {
    if (!isIntegrationProvider(provider)) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }
    await this.integrations.disconnect(businessId, provider);
    return { ok: true };
  }
}

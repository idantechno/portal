import {
  Body,
  Controller,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { BusinessOwnerGuard } from '../businesses/guards/business-owner.guard';
import { EmbeddedSignupExchangeDto } from './dto/embedded-signup-exchange.dto';
import { WhatsappConnectionsService } from './whatsapp-connections.service';

interface TokenExchangeResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

interface PhoneNumberResponse {
  display_phone_number?: string;
  verified_name?: string;
  id?: string;
}

@UseGuards(BusinessScopeGuard, BusinessOwnerGuard)
@Controller('businesses/:businessId/channels/whatsapp')
export class WhatsappOnboardingController {
  private readonly log = new Logger(WhatsappOnboardingController.name);

  constructor(
    private readonly cfg: ConfigService,
    private readonly conns: WhatsappConnectionsService,
  ) {}

  @Post('embedded-signup')
  async exchange(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: EmbeddedSignupExchangeDto,
  ) {
    const appId = this.cfg.get<string>('META_APP_ID');
    const appSecret = this.cfg.get<string>('META_APP_SECRET');
    const apiVersion = this.cfg.get<string>('META_GRAPH_API_VERSION', 'v21.0');

    if (!appId || !appSecret) {
      throw new ServiceUnavailableException(
        'WhatsApp onboarding is not yet available — Meta app credentials are not configured on the server.',
      );
    }

    const tokenUrl =
      `https://graph.facebook.com/${apiVersion}/oauth/access_token` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&code=${encodeURIComponent(dto.code)}`;

    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      this.log.warn(
        `Meta token exchange failed for business ${businessId}: HTTP ${tokenRes.status} ${body.slice(0, 300)}`,
      );
      throw new UnauthorizedException('Meta rejected the authorization code');
    }
    const tokenJson = (await tokenRes.json()) as TokenExchangeResponse;
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      throw new UnauthorizedException('Meta did not return an access token');
    }

    // Resolve the display phone number so the UI can show "Connected to +972…"
    let displayPhoneNumber: string | null = null;
    try {
      const phoneRes = await fetch(
        `https://graph.facebook.com/${apiVersion}/${dto.phoneNumberId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (phoneRes.ok) {
        const phoneJson = (await phoneRes.json()) as PhoneNumberResponse;
        displayPhoneNumber = phoneJson.display_phone_number ?? null;
      }
    } catch (err) {
      this.log.warn(
        `Failed to fetch phone metadata for ${dto.phoneNumberId}: ${(err as Error).message}`,
      );
    }

    // Subscribe our app to this WABA's webhook events.
    const subscribeRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${dto.wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!subscribeRes.ok) {
      const body = await subscribeRes.text();
      this.log.warn(
        `Failed to subscribe app to WABA ${dto.wabaId}: HTTP ${subscribeRes.status} ${body.slice(0, 300)}`,
      );
      // Persist the connection anyway in failed state so the UI can surface it.
      const failed = await this.conns.connect({
        businessId,
        phoneNumberId: dto.phoneNumberId,
        wabaId: dto.wabaId,
        metaBusinessId: dto.metaBusinessId ?? null,
        displayPhoneNumber,
        accessToken,
      });
      await this.conns.markFailed(
        failed.id,
        `subscribed_apps failed: HTTP ${subscribeRes.status}`,
      );
      return this.conns.toPublic(
        (await this.conns.findByBusinessId(businessId))!,
      );
    }

    const conn = await this.conns.connect({
      businessId,
      phoneNumberId: dto.phoneNumberId,
      wabaId: dto.wabaId,
      metaBusinessId: dto.metaBusinessId ?? null,
      displayPhoneNumber,
      accessToken,
    });
    return this.conns.toPublic(conn);
  }
}

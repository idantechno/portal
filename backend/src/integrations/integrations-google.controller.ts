import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { IntegrationsService } from './integrations.service';

/**
 * Public OAuth redirect target for Google. No JWT — Google's browser redirect
 * hits this directly. The `state` param carries businessId:provider, and we
 * bounce the browser back to the business's integrations page when done.
 *
 * The matching redirect URI must be registered in the Google Cloud Console:
 *   {GOOGLE_REDIRECT_URI}  (default http://localhost:3000/api/integrations/google/callback)
 */
@Public()
@Controller('integrations/google')
export class IntegrationsGoogleController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error || !code || !state) {
      // User denied consent or Google returned an error — bounce to the
      // business's integrations page on the frontend.
      return res.redirect(
        this.integrations.errorRedirectUrl(state, error ?? 'missing_code'),
      );
    }
    const url = await this.integrations.handleCallback(code, state);
    return res.redirect(url);
  }
}

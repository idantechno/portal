import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { QuotePdfService } from './quote-pdf.service';

/**
 * Public, token-authenticated quote PDF. No JWT / no business scope — the
 * unguessable `public_token` is the auth. This is the link the frontend embeds
 * in a wa.me message so a customer can open the branded quote.
 */
@Public()
@Controller('quotes/p')
export class QuotesPublicController {
  constructor(private readonly pdfService: QuotePdfService) {}

  @Get(':token/pdf')
  @Header('Content-Type', 'application/pdf')
  async pdf(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Buffer> {
    const { buffer, filename } = await this.pdfService.pdfByToken(token);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return buffer;
  }
}

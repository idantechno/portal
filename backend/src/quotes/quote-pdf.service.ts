import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service';
import { PdfRendererService } from '../documents/pdf-renderer.service';
import { renderQuoteHtml } from './quote-html';
import { QuotesService } from './quotes.service';

/**
 * Renders a branded PDF for a quote — both the authed (business-scoped) path and
 * the public token path used by the shareable link. Reuses the single long-lived
 * headless-Chromium instance via PdfRendererService (the trusted render path).
 */
@Injectable()
export class QuotePdfService {
  constructor(
    private readonly renderer: PdfRendererService,
    private readonly businesses: BusinessesService,
    private readonly quotes: QuotesService,
  ) {}

  /** Authed render: the quote is looked up scoped to the business. */
  async pdf(businessId: string, quoteId: string): Promise<Buffer> {
    const quote = await this.quotes.findByIdScoped(businessId, quoteId);
    const business = await this.businesses.findById(businessId);
    if (!business) {
      throw new NotFoundException(`Business ${businessId} not found`);
    }
    return this.renderer.renderHtmlToPdf(renderQuoteHtml(quote, business));
  }

  /** Public render: the unguessable token is the auth. */
  async pdfByToken(
    token: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const quote = await this.quotes.findByPublicToken(token);
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    const business = await this.businesses.findById(quote.businessId);
    if (!business) {
      throw new NotFoundException(`Business ${quote.businessId} not found`);
    }
    const buffer = await this.renderer.renderHtmlToPdf(
      renderQuoteHtml(quote, business),
    );
    return { buffer, filename: `quote-${quote.id}.pdf` };
  }
}

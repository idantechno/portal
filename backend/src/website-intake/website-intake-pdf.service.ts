import { Injectable } from '@nestjs/common';
import { PdfRendererService } from '../documents/pdf-renderer.service';
import { renderIntakeHtml, IntakeHtmlAssets } from './intake-html';
import { WebsiteIntake } from './website-intake.entity';
import { WebsiteIntakeService } from './website-intake.service';

/**
 * Renders a branded PDF for a website-intake brief — both the authed
 * (business-scoped) operator path and the public token path used by the client's
 * "הורד PDF" button on the success screen. Reuses the shared long-lived
 * headless-Chromium instance via PdfRendererService.
 */
@Injectable()
export class WebsiteIntakePdfService {
  constructor(
    private readonly renderer: PdfRendererService,
    private readonly intake: WebsiteIntakeService,
  ) {}

  /** Authed render: the intake is looked up scoped to the business. */
  async pdf(businessId: string, id: string): Promise<Buffer> {
    const intake = await this.intake.findByIdScoped(businessId, id);
    return this.render(intake);
  }

  /** Public render: the unguessable token is the auth. */
  async pdfByToken(
    token: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const intake = await this.intake.findByPublicToken(token);
    const buffer = await this.render(intake);
    return { buffer, filename: this.filename(intake) };
  }

  private async render(intake: WebsiteIntake): Promise<Buffer> {
    const assets: IntakeHtmlAssets = {
      logo: await this.intake.assetDataUri(intake.businessId, intake.logo),
      images: (
        await Promise.all(
          (intake.images ?? []).map((img) =>
            this.intake.assetDataUri(intake.businessId, img),
          ),
        )
      ).filter((u): u is string => u !== null),
    };
    return this.renderer.renderHtmlToPdf(renderIntakeHtml(intake, assets));
  }

  private filename(intake: WebsiteIntake): string {
    const base = (intake.businessName || intake.contactName || 'brief')
      .replace(/[^\p{L}\p{N}\-_ ]/gu, '')
      .trim()
      .slice(0, 60);
    return `בריף-אתר-${base || 'brief'}.pdf`;
  }
}

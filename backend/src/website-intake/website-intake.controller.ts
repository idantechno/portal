import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Express } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { UploadedAsset, WebsiteIntakeService } from './website-intake.service';
import { WebsiteIntakePdfService } from './website-intake-pdf.service';
import { SubmitWebsiteIntakePayload } from './dto/submit-website-intake.dto';

const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12MB per file — full-res photos.

function toAsset(file: Express.Multer.File): UploadedAsset {
  return {
    // Multer decodes multipart filenames as latin1; re-decode as UTF-8 so
    // Hebrew filenames survive instead of turning into mojibake.
    originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
    buffer: file.buffer,
    mimeType: file.mimetype,
    size: file.size,
  };
}

/**
 * Public intake form (`/website-brief`) + the operator-facing read side.
 *
 * The public POST is unauthenticated, rate-limited and honeypot-guarded; it
 * accepts a stringified `payload` field plus a `logo` file and up to 5 `images`.
 * The GET routes are business-scoped and let the operator list/download an
 * intake's answers and assets from the customer page.
 */
@Controller()
export class WebsiteIntakeController {
  constructor(
    private readonly intake: WebsiteIntakeService,
    private readonly pdf: WebsiteIntakePdfService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('website-intake')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'images', maxCount: 5 },
      ],
      { limits: { fileSize: MAX_FILE_BYTES } },
    ),
  )
  async submit(
    @Body('payload') payloadRaw: string | undefined,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    if (!payloadRaw) throw new BadRequestException('חסר תוכן הטופס');
    let payload: SubmitWebsiteIntakePayload;
    try {
      payload = JSON.parse(payloadRaw) as SubmitWebsiteIntakePayload;
    } catch {
      throw new BadRequestException('מבנה הטופס שגוי');
    }
    return this.intake.submit(payload, {
      logo: files.logo?.[0] ? toAsset(files.logo[0]) : undefined,
      images: (files.images ?? []).map(toAsset),
    });
  }

  @UseGuards(BusinessScopeGuard)
  @Get('businesses/:businessId/website-intakes')
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.intake.listForCustomer(businessId, customerId);
  }

  /** Operator PDF — business-scoped. Streamed as binary (returning a Buffer
   *  through Nest's reply path would JSON-serialize it). */
  @UseGuards(BusinessScopeGuard)
  @Get('businesses/:businessId/website-intakes/:id/pdf')
  async operatorPdf(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.pdf.pdf(businessId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="brief.pdf"');
    res.end(buffer);
  }

  /** Client PDF — the unguessable token is the auth (no JWT). This is the link
   *  behind the "הורד PDF" button on the success screen. */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Get('website-intake/p/:token/pdf')
  async publicPdf(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.pdf.pdfByToken(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(filename)}"`,
    );
    res.end(buffer);
  }

  @UseGuards(BusinessScopeGuard)
  @Get('businesses/:businessId/website-intakes/:id/assets/:kind/:index')
  async downloadAsset(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('kind') kind: string,
    @Param('index') index: string,
    @Res() res: Response,
  ) {
    if (kind !== 'logo' && kind !== 'image') {
      throw new BadRequestException('Invalid asset kind');
    }
    const idx = Number.parseInt(index, 10);
    const { asset, buffer } = await this.intake.readAsset(
      businessId,
      id,
      kind,
      Number.isNaN(idx) ? 0 : idx,
    );
    res.set({
      'Content-Type': asset.mime,
      'Content-Disposition': `inline; filename="${encodeURIComponent(
        asset.name,
      )}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }
}

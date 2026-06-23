import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { BusinessesService } from '../businesses/businesses.service';
import { DocumentStatus } from '../common/enums/document-status.enum';
import { DocumentPdfService } from './document-pdf.service';
import { DocumentInstance } from './document-instance.entity';
import { DocumentsService } from './documents.service';
import { SubmitSigningDto } from './dto/submit-signing.dto';

/**
 * Public, token-authenticated endpoints for the recipient signing flow.
 * No JWT / no business scope — the unguessable `public_token` is the auth.
 */
@Public()
@Controller('sign')
export class DocumentsPublicController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly businesses: BusinessesService,
    private readonly pdf: DocumentPdfService,
  ) {}

  @Get(':token')
  async view(@Param('token') token: string) {
    const instance = await this.requireOpenInstance(token);
    const business = await this.businesses.findById(instance.businessId);
    const snapshot = instance.templateSnapshot;

    return {
      status: instance.status,
      businessName: business?.name ?? '',
      brand: snapshot.config.brand,
      boilerplate: snapshot.config.boilerplate,
      variables: instance.variables,
      recipientFields: instance.recipientFields,
      signedAt: instance.signedAt,
      pdfUrl:
        instance.status === DocumentStatus.Signed
          ? `/api/sign/${token}/pdf`
          : null,
    };
  }

  @Post(':token/submit')
  async submit(@Param('token') token: string, @Body() dto: SubmitSigningDto) {
    const instance = await this.pdf.submitSigning(
      token,
      { signerFullName: dto.signerFullName, signerId: dto.signerId },
      dto.signatureSvg,
    );
    return {
      status: instance.status,
      signedAt: instance.signedAt,
      pdfUrl: `/api/sign/${token}/pdf`,
    };
  }

  @Get(':token/pdf')
  @Header('Content-Type', 'application/pdf')
  async pdfDownload(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Buffer> {
    const buffer = await this.pdf.readSignedPdfByToken(token);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="signed-${token}.pdf"`,
    );
    return buffer;
  }

  private async requireOpenInstance(token: string): Promise<DocumentInstance> {
    const instance = await this.documents.findInstanceByPublicToken(token);
    if (!instance) {
      throw new NotFoundException('Document not found');
    }
    if (instance.status === DocumentStatus.Cancelled) {
      throw new NotFoundException('Document is no longer available');
    }
    return instance;
  }
}

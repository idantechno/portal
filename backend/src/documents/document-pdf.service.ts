import * as Handlebars from 'handlebars';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service';
import { DocumentStatus } from '../common/enums/document-status.enum';
import { FilesystemService } from '../context-files/filesystem.service';
import { DocumentInstance } from './document-instance.entity';
import { DocumentsService } from './documents.service';
import { RecipientFields } from './documents.types';
import { PdfRendererService } from './pdf-renderer.service';
import { buildRenderContext } from './render-context';

const SIGNED_PDF_PATH = (id: string) => `documents/${id}.pdf`;

/**
 * Orchestrates PDF generation for a DocumentInstance: loads the business,
 * fills the snapshot template with Handlebars, then renders to PDF via
 * Puppeteer. Signed PDFs are persisted under BUSINESSES_DIR; preview PDFs
 * (unsigned) are returned without persistence.
 */
@Injectable()
export class DocumentPdfService {
  constructor(
    private readonly documents: DocumentsService,
    private readonly businesses: BusinessesService,
    private readonly filesystem: FilesystemService,
    private readonly renderer: PdfRendererService,
  ) {}

  async getOrRenderPdf(
    businessId: string,
    instanceId: string,
  ): Promise<Buffer> {
    const instance = await this.documents.findInstanceByIdScoped(
      businessId,
      instanceId,
    );
    if (instance.signedPdfPath) {
      const exists = await this.filesystem.exists(
        businessId,
        instance.signedPdfPath,
      );
      if (exists) {
        return this.filesystem.readFile(businessId, instance.signedPdfPath);
      }
    }
    return this.renderInstance(businessId, instance);
  }

  /**
   * Recipient submission: writes recipient_fields + signature, renders the
   * final signed PDF, persists it, and flips the instance to `signed`.
   * Idempotent — calling on an already-signed instance is a no-op.
   */
  async submitSigning(
    token: string,
    recipientFields: RecipientFields,
    signatureSvg: string,
  ): Promise<DocumentInstance> {
    const instance = await this.documents.findInstanceByPublicToken(token);
    if (!instance) {
      throw new NotFoundException('Document not found');
    }
    if (instance.status === DocumentStatus.Cancelled) {
      throw new BadRequestException('Document has been cancelled');
    }
    if (instance.status === DocumentStatus.Signed) {
      return instance;
    }

    instance.recipientFields = recipientFields;
    instance.signatureSvg = signatureSvg;
    instance.signedAt = new Date();
    instance.status = DocumentStatus.Signed;

    const buffer = await this.renderInstance(instance.businessId, instance);
    const relativePath = SIGNED_PDF_PATH(instance.id);
    await this.filesystem.writeFile(instance.businessId, relativePath, buffer);
    instance.signedPdfPath = relativePath;

    return this.documents.saveInstance(instance);
  }

  async readSignedPdfByToken(token: string): Promise<Buffer> {
    const instance = await this.documents.findInstanceByPublicToken(token);
    if (!instance) {
      throw new NotFoundException('Document not found');
    }
    if (!instance.signedPdfPath) {
      throw new NotFoundException('Document has not been signed yet');
    }
    return this.filesystem.readFile(
      instance.businessId,
      instance.signedPdfPath,
    );
  }

  private async renderInstance(
    businessId: string,
    instance: DocumentInstance,
  ): Promise<Buffer> {
    const business = await this.businesses.findById(businessId);
    if (!business) {
      throw new NotFoundException(`Business ${businessId} not found`);
    }
    const snapshot = instance.templateSnapshot;
    const template = Handlebars.compile(snapshot.htmlTemplate, {
      noEscape: false,
    });
    const html = template(
      buildRenderContext({
        business,
        brand: snapshot.config.brand,
        boilerplate: snapshot.config.boilerplate,
        variables: instance.variables,
        signer: instance.recipientFields,
        signatureSvg: instance.signatureSvg,
        signedAt: instance.signedAt,
      }),
    );
    return this.renderer.renderHtmlToPdf(html);
  }
}

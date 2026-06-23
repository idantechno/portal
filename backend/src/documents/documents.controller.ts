import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { DocumentPdfService } from './document-pdf.service';
import { DocumentsAgentService } from './documents-agent.service';
import { DocumentsService } from './documents.service';
import { DocumentsChatDto } from './dto/documents-chat.dto';
import { UpsertBusinessConfigDto } from './dto/upsert-business-config.dto';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly agent: DocumentsAgentService,
    private readonly pdf: DocumentPdfService,
  ) {}

  @Get('documents/:id/pdf')
  @Header('Content-Type', 'application/pdf')
  async getPdf(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Buffer> {
    const buffer = await this.pdf.getOrRenderPdf(businessId, id);
    res.setHeader('Content-Disposition', `inline; filename="${id}.pdf"`);
    return buffer;
  }

  @Post('agents/documents/chat')
  chat(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: DocumentsChatDto,
  ) {
    return this.agent.chat({ businessId, history: dto.history });
  }

  @Get('document-templates')
  listTemplates(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.documents.listAvailableTemplates(businessId);
  }

  @Get('business-template-configs/:templateId')
  getConfig(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    return this.documents.getBusinessConfig(businessId, templateId);
  }

  @Patch('business-template-configs/:templateId')
  updateConfig(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: UpsertBusinessConfigDto,
  ) {
    return this.documents.upsertBusinessConfig(businessId, templateId, dto);
  }

  @Get('documents')
  listInstances(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.documents.listInstances(businessId);
  }

  @Get('documents/:id')
  getInstance(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.findInstanceByIdScoped(businessId, id);
  }

  @Post('documents/:id/cancel')
  cancelInstance(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.cancelInstance(businessId, id);
  }
}

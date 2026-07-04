import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { DesignerAgentService } from './designer-agent.service';
import { DesignerService } from './designer.service';
import { DesignerChatDto } from './dto/designer-chat.dto';

@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('designer')
@Controller('businesses/:businessId')
export class DesignerController {
  constructor(
    private readonly designer: DesignerService,
    private readonly agent: DesignerAgentService,
  ) {}

  @Post('agents/designer/chat')
  chat(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: DesignerChatDto,
  ) {
    return this.agent.chat({ businessId, history: dto.history });
  }

  @Get('designs')
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.designer.list(businessId);
  }

  @Get('designs/:id/pdf')
  @Header('Content-Type', 'application/pdf')
  async getPdf(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Buffer> {
    const buffer = await this.designer.renderPdf(businessId, id);
    res.setHeader('Content-Disposition', `inline; filename="${id}.pdf"`);
    return buffer;
  }

  @Delete('designs/:id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.designer.remove(businessId, id);
    return { ok: true };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { BriefGeneratorService } from './brief-generator.service';
import { BriefsService } from './briefs.service';
import { GenerateBriefDto } from './dto/generate-brief.dto';
import { UpdateBriefDto } from './dto/update-brief.dto';

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId')
export class BriefsController {
  constructor(
    private readonly briefs: BriefsService,
    private readonly generator: BriefGeneratorService,
  ) {}

  /** Generating fans out to a website crawl + a large model call — rate-limit it. */
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('leads/:leadId/brief')
  generate(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: GenerateBriefDto,
  ) {
    return this.generator.generate({
      businessId,
      leadId,
      websiteUrl: dto.websiteUrl ?? null,
      skipDrafting: dto.skipDrafting ?? false,
    });
  }

  @Get('briefs')
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.briefs.list(businessId);
  }

  @Get('briefs/:id')
  get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.briefs.findByIdScoped(businessId, id);
  }

  @Patch('briefs/:id')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBriefDto,
  ) {
    return this.briefs.update(businessId, id, dto);
  }

  @Delete('briefs/:id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.briefs.remove(businessId, id);
    return { ok: true };
  }
}

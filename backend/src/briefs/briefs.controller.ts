import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { CustomersService } from '../customers/customers.service';
import { BriefGeneratorService } from './brief-generator.service';
import { BriefsService } from './briefs.service';
import { GenerateBriefDto } from './dto/generate-brief.dto';
import { UpdateBriefDto } from './dto/update-brief.dto';

// The brief generator is the marketing agent's tool — only businesses granted
// the "marketing" agent (an admin decision) can reach any of these routes.
@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('marketing')
@Controller('businesses/:businessId')
export class BriefsController {
  constructor(
    private readonly briefs: BriefsService,
    private readonly generator: BriefGeneratorService,
    private readonly customers: CustomersService,
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

  /**
   * Generate a brief for a customer. The brief pipeline needs questionnaire
   * answers, which live on the lead the customer was promoted from — so this
   * requires the customer to have a `leadId`. A manually-added customer has no
   * questionnaire behind it and gets a clear 400 instead of an invented brief.
   */
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('customers/:customerId/brief')
  async generateForCustomer(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: GenerateBriefDto,
  ) {
    const customer = await this.customers.findByIdScoped(
      businessId,
      customerId,
    );
    if (!customer.leadId) {
      throw new BadRequestException(
        'ללקוח הזה אין שאלון אסטרטגיה — אין ממה להפיק בריף. אפשר להמיר ליד משאלון ללקוח, או להוסיף לו שאלון בהמשך.',
      );
    }
    return this.generator.generate({
      businessId,
      leadId: customer.leadId,
      customerId: customer.id,
      websiteUrl: dto.websiteUrl ?? null,
      skipDrafting: dto.skipDrafting ?? false,
    });
  }

  @Get('briefs')
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.briefs.list(businessId, customerId);
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

import {
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
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { QuotesService } from './quotes.service';
import { QuoteDrafterService } from './quote-drafter.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { DraftQuoteDto } from './dto/draft-quote.dto';
import { renderQuote } from './quote-renderer';

/**
 * Quotes are business-wide customer documents (like customers themselves), not
 * gated on a single agent: they're authored at the quote agent and read in the
 * marketing agent's customer reports. Business scope is the only guard.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId')
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly drafter: QuoteDrafterService,
  ) {}

  @Post('customers/:customerId/quotes')
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotes.create({ businessId, customerId, ...dto });
  }

  @Get('quotes')
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.quotes.list(businessId, customerId);
  }

  @Get('quotes/:id')
  async get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const quote = await this.quotes.findByIdScoped(businessId, id);
    return { ...quote, markdown: renderQuote(quote) };
  }

  /**
   * AI-drafts a business-tailored quote body from a one-line brief. Returns the
   * draft (scope + line items with EMPTY prices + terms) for the operator to
   * review, price, and save — it does not persist anything itself.
   */
  @Post('quotes/:id/draft')
  async draft(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DraftQuoteDto,
  ) {
    // Assert the quote exists and is this business's before spending a model call.
    await this.quotes.findByIdScoped(businessId, id);
    return this.drafter.draft(businessId, dto.brief);
  }

  @Patch('quotes/:id')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.quotes.update(businessId, id, dto);
  }

  @Delete('quotes/:id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.quotes.remove(businessId, id);
    return { ok: true };
  }
}

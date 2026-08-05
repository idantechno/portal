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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers.dto';

/**
 * The central customers list. NOT agent-gated — customers are a business-wide
 * concept every agent shares, so any authorized member of the business can
 * manage them here. Agent-specific documents (briefs, strategies, …) are
 * generated through those agents' own gated routes and linked back by
 * `customer_id`.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customers.create(businessId, dto);
  }

  /** Promote a marketing lead into a customer (the "המר ללקוח" action). */
  @Post('from-lead/:leadId')
  createFromLead(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ) {
    return this.customers.createFromLead(businessId, leadId);
  }

  /** Promote a conversation contact (WhatsApp/web lead) into a customer. */
  @Post('from-contact/:contactId')
  createFromContact(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.customers.createFromContact(businessId, contactId);
  }

  @Get()
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListCustomersQueryDto,
  ) {
    return this.customers.list(businessId, query.sort ?? 'recent', query.stage);
  }

  @Get(':id')
  get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customers.findByIdScoped(businessId, id);
  }

  @Patch(':id')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(businessId, id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.customers.remove(businessId, id);
    return { ok: true };
  }
}

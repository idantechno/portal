import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { ConversationsService } from './conversations.service';
import { CustomerContactsService } from './customer-contacts.service';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactStatus } from '../common/enums/contact-status.enum';

class ListContactsQueryDto {
  @IsEnum(ContactStatus)
  status!: ContactStatus;
}

/**
 * The customer "card" — one end-user identified by their phone number, with the
 * relationship status, operator notes and their full cross-conversation history.
 * Distinct from the conversation controller: settings live on the *number*, not
 * on a single thread.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/contacts')
export class ContactsController {
  constructor(
    private readonly contacts: CustomerContactsService,
    private readonly conversations: ConversationsService,
  ) {}

  @Get()
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListContactsQueryDto,
  ) {
    return this.contacts.listByStatus(businessId, query.status);
  }

  @Get(':contactId')
  async card(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    const contact = await this.contacts.findByIdScoped(businessId, contactId);
    const [conversations, stats] = await Promise.all([
      this.conversations.listByContact(businessId, contactId),
      this.conversations.contactStats(businessId, contactId),
    ]);
    return { contact, conversations, stats };
  }

  @Patch(':contactId')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contacts.updateProfile(businessId, contactId, dto);
  }
}

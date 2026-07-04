import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { SupportRequestStatus } from './support-request.entity';
import { SupportRequestsService } from './support-requests.service';

/**
 * Cross-tenant support inbox for platform staff (idant). Enforcement comes from
 * the globally-registered RolesGuard reading the class-level @Roles metadata.
 */
@Roles(UserRole.SuperAdmin, UserRole.Support)
@Controller('admin/support-requests')
export class SupportAdminController {
  constructor(private readonly support: SupportRequestsService) {}

  @Get()
  list(@Query('status') status?: SupportRequestStatus) {
    return this.support.listAll(status === 'resolved' ? 'resolved' : 'open');
  }

  @Post(':id/resolve')
  resolve(@Param('id', ParseUUIDPipe) id: string) {
    return this.support.resolve(id);
  }
}

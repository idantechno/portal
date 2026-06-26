import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AgentsService } from './agents.service';

/**
 * The agents the current user is entitled to across their businesses — drives
 * the dashboard tools list. Authenticated (global JwtAuthGuard); no extra role.
 */
@Controller('me/agents')
export class MyAgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.agents.entitledForUser(user.id);
  }
}

import { SetMetadata } from '@nestjs/common';
import { AgentKey } from '../agent-catalog';

export const REQUIRE_AGENT_KEY = 'require_agent';

/**
 * Declares that a route requires the business to have access to a given agent.
 * Enforced by RequireAgentGuard, which must run after BusinessScopeGuard.
 * Platform staff bypass.
 */
export const RequireAgent = (key: AgentKey) =>
  SetMetadata(REQUIRE_AGENT_KEY, key);

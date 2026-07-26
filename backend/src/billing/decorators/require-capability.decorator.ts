import { SetMetadata } from '@nestjs/common';
import type { PlanCapability } from '../plan-capabilities';

export const REQUIRE_CAPABILITY_KEY = 'require_capability';

/**
 * Declares that a route requires the scoped business's plan to include a given
 * capability (see `plan-capabilities.ts`). Enforced by RequireCapabilityGuard,
 * which must run after BusinessScopeGuard. Platform staff bypass.
 *
 * This is the plan-tier counterpart to @RequireAgent: use it to keep a paid
 * feature (Google connect, the manual calendar) off the tiers that don't sell
 * it, regardless of what the UI shows.
 */
export const RequireCapability = (capability: PlanCapability) =>
  SetMetadata(REQUIRE_CAPABILITY_KEY, capability);

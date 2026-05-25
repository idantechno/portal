import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as not requiring authentication. The global JwtAuthGuard
 * skips routes flagged with this decorator.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** BullMQ queue carrying the daily "hard-purge expired tenants" sweep. */
export const BUSINESS_PURGE_QUEUE = 'business-purge';

/**
 * Grace window between scheduling a tenant for deletion (soft delete) and the
 * irreversible hard purge. Within this window an operator can restore. 30 days
 * is a reasonable erasure delay under Israeli Privacy Law (תיקון 13) and GDPR.
 */
export const PURGE_AFTER_DAYS = 30;

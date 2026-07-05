/**
 * Shared react-query key factories so pages that read the same endpoints cache
 * (and invalidate) under identical keys. Without this, Home/Growth cached
 * billing under one shape while Billing.tsx used another, so invalidating one
 * left the other stale.
 */
export const billingKeys = {
  plans: (businessId: string) => ["billing", "plans", businessId] as const,
  subscription: (businessId: string) =>
    ["billing", "subscription", businessId] as const,
  invoices: (businessId: string) =>
    ["billing", "invoices", businessId] as const,
};

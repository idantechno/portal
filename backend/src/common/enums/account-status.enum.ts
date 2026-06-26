/**
 * Lifecycle status shared by users and businesses. Suspended users cannot log
 * in; suspended businesses stop routing inbound messages (enforcement is added
 * where each is read).
 */
export enum AccountStatus {
  Active = 'active',
  Suspended = 'suspended',
}

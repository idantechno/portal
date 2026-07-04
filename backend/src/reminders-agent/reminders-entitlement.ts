/**
 * The reminders agent is offered as a 3-day free trial (anchored to when the
 * business was created) and then requires a paid plan. Platform staff always
 * bypass the lock (enforced at the controller). No extra storage is needed —
 * the trial window is derived from the business's createdAt.
 */
export const REMINDERS_TRIAL_DAYS = 3;
const PAID_PLANS = ['growth', 'scale'];
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RemindersEntitlement {
  /** Business is on a paid plan that includes reminders. */
  paid: boolean;
  /** Still inside the free-trial window. */
  onTrial: boolean;
  /** Neither paid nor on trial → the agent is locked. */
  locked: boolean;
  /** ISO timestamp when the trial ends. */
  trialEndsAt: string;
  /** Whole days left in the trial (0 once it has ended). */
  daysLeft: number;
}

export function computeRemindersEntitlement(
  businessCreatedAt: Date | string,
  planCode: string,
  status: string,
): RemindersEntitlement {
  const created = new Date(businessCreatedAt).getTime();
  const trialEnd = created + REMINDERS_TRIAL_DAYS * DAY_MS;
  const now = Date.now();
  const onTrial = now < trialEnd;
  const paid =
    PAID_PLANS.includes(planCode) &&
    (status === 'active' || status === 'trialing');
  const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / DAY_MS));
  return {
    paid,
    onTrial,
    locked: !paid && !onTrial,
    trialEndsAt: new Date(trialEnd).toISOString(),
    daysLeft,
  };
}

import { planCapabilities, PLAN_CAPABILITIES } from './plan-capabilities';
import { PLAN_CATALOG } from './billing-plans';

describe('plan capabilities', () => {
  it('maps every sellable plan to a capability set', () => {
    for (const plan of PLAN_CATALOG) {
      expect(PLAN_CAPABILITIES[plan.code]).toBeDefined();
    }
  });

  it('gives an unknown plan no capabilities (default deny)', () => {
    expect(planCapabilities('does-not-exist')).toEqual([]);
    expect(planCapabilities('free')).toEqual([]); // retired plan
  });

  // The boundary the pricing tiers are built on: only the top tier lets the
  // agent itself book/cancel/move appointments or touch Google. If this ever
  // regresses, a cheaper tier's chat agent could close meetings — the exact
  // leak this capability layer was introduced to close.
  it('keeps agent scheduling + Google on the top tier only', () => {
    expect(planCapabilities('basic')).not.toContain('agent_scheduling');
    expect(planCapabilities('growth')).not.toContain('agent_scheduling');
    expect(planCapabilities('exclusive')).toContain('agent_scheduling');

    expect(planCapabilities('basic')).not.toContain('google');
    expect(planCapabilities('growth')).not.toContain('google');
    expect(planCapabilities('exclusive')).toContain('google');
  });

  it('unlocks the manual calendar from the middle tier up, never on basic', () => {
    expect(planCapabilities('basic')).not.toContain('calendar_manual');
    expect(planCapabilities('growth')).toContain('calendar_manual');
    expect(planCapabilities('exclusive')).toContain('calendar_manual');
  });

  it('is monotonic — each tier is a superset of the one below', () => {
    const basic = new Set(planCapabilities('basic'));
    const growth = new Set(planCapabilities('growth'));
    const exclusive = new Set(planCapabilities('exclusive'));
    for (const cap of basic) expect(growth.has(cap)).toBe(true);
    for (const cap of growth) expect(exclusive.has(cap)).toBe(true);
  });
});

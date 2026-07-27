import { Business } from '../businesses/business.entity';

/**
 * Renders the owner's onboarding profile into a compact English block that is
 * appended to every agent's dynamic system-prompt section, so all agents speak
 * and act in line with the business. Returns null when nothing was filled in.
 *
 * Kept in the DYNAMIC (per-run) prompt section — it is business data, not the
 * cacheable static prefix.
 */
export function renderOnboardingProfile(business: Business): string | null {
  const o = business.onboarding;
  if (!o) return null;
  const parts: string[] = [];
  if (o.industry) parts.push(`- Field / what the business does: ${o.industry}`);
  if (o.audience) parts.push(`- Target customers: ${o.audience}`);
  if (o.offerings) parts.push(`- Main products / services: ${o.offerings}`);
  if (o.tone) parts.push(`- Desired tone of voice toward customers: ${o.tone}`);
  if (o.values?.length)
    parts.push(`- Brand values that represent it: ${o.values.join(', ')}`);
  if (o.feeling)
    parts.push(`- Feeling a customer should leave with: ${o.feeling}`);
  if (o.goals) parts.push(`- Business goals: ${o.goals}`);
  if (o.differentiators)
    parts.push(`- What sets it apart: ${o.differentiators}`);
  if (o.notes) parts.push(`- Emphasize / avoid: ${o.notes}`);
  if (parts.length === 0) return null;
  return `About this business (use it to tailor everything you say and produce):\n${parts.join(
    '\n',
  )}`;
}

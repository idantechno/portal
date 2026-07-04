/**
 * Lifecycle of an idea captured by the ideas agent.
 * - seed: just captured, still raw.
 * - shaping: the agent has cleaned up the wording / summary.
 * - developed: the idea has a concrete direction, plan, or first move.
 */
export enum IdeaStatus {
  Seed = 'seed',
  Shaping = 'shaping',
  Developed = 'developed',
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One-off data fix: the operator's own business (Portal Studio) already has all
 * its identity captured in the info center, so the first-login welcome wizard is
 * redundant for it. This stamps `onboarding.completed = true` on that business so
 * the owner logs straight into the cockpit.
 *
 * We match on the BUSINESS identity (name/slug), deliberately NOT on an owner
 * email: the business owner is a separate `Member` account (see
 * AdminService.createClient), distinct from the super-admin account, and its
 * exact address isn't knowable from the code. Matching the sole Portal Studio
 * business by name/slug avoids that ambiguity.
 *
 * Scoped so every other/future business that signs up still gets the welcome
 * wizard (the gate in BusinessLayout keys off this same `onboarding.completed`
 * flag). Any existing onboarding data is preserved.
 */
export class CompleteOnboardingForOperator1784400000000 implements MigrationInterface {
  name = 'CompleteOnboardingForOperator1784400000000';

  /** Case-insensitive match against businesses.name / businesses.slug. */
  private static readonly MATCH = '%portal%';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "businesses"
         SET "onboarding" = jsonb_set(
           COALESCE("onboarding", '{}'::jsonb),
           '{completed}',
           'true'::jsonb,
           true
         )
       WHERE lower("name") LIKE $1 OR lower("slug") LIKE $1`,
      [CompleteOnboardingForOperator1784400000000.MATCH],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse the flag for the same business so the wizard would show again.
    await queryRunner.query(
      `UPDATE "businesses"
         SET "onboarding" = jsonb_set(
           COALESCE("onboarding", '{}'::jsonb),
           '{completed}',
           'false'::jsonb,
           true
         )
       WHERE lower("name") LIKE $1 OR lower("slug") LIKE $1`,
      [CompleteOnboardingForOperator1784400000000.MATCH],
    );
  }
}

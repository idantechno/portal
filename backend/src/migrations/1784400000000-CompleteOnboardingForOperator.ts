import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One-off data fix: the operator's own business (Portal Studio) already has all
 * its identity captured in the info center, so the first-login welcome wizard is
 * redundant for it. This stamps `onboarding.completed = true` on that single
 * business — identified by its owner's email, not a hard-coded id — so the owner
 * logs straight into the cockpit.
 *
 * Scoped to the operator account only: every other/future business that signs up
 * still gets the welcome wizard (the gate in BusinessLayout keys off this same
 * `onboarding.completed` flag). Existing onboarding data, if any, is preserved.
 */
export class CompleteOnboardingForOperator1784400000000 implements MigrationInterface {
  name = 'CompleteOnboardingForOperator1784400000000';

  private static readonly OPERATOR_EMAIL = 'idantechno@gmail.com';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "businesses"
         SET "onboarding" = jsonb_set(
           COALESCE("onboarding", '{}'::jsonb),
           '{completed}',
           'true'::jsonb,
           true
         )
       WHERE "owner_user_id" IN (
         SELECT "id" FROM "users" WHERE lower("email") = $1
       )`,
      [CompleteOnboardingForOperator1784400000000.OPERATOR_EMAIL],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse the flag for the same account so the wizard would show again.
    await queryRunner.query(
      `UPDATE "businesses"
         SET "onboarding" = jsonb_set(
           COALESCE("onboarding", '{}'::jsonb),
           '{completed}',
           'false'::jsonb,
           true
         )
       WHERE "owner_user_id" IN (
         SELECT "id" FROM "users" WHERE lower("email") = $1
       )`,
      [CompleteOnboardingForOperator1784400000000.OPERATOR_EMAIL],
    );
  }
}
